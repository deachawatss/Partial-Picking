using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PK.BridgeService.Models;
using PK.BridgeService.Options;

namespace PK.BridgeService.Services;

public sealed class ScalePollingHostedService : IHostedService, IAsyncDisposable
{
    private readonly ScaleConfigurationService _configurationService;
    private readonly ScaleBroadcastService _broadcastService;
    private readonly ScaleServiceOptions _options;
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<ScalePollingHostedService> _logger;

    private readonly List<(SerialScaleReader reader, Task task)> _activeReaders = new();
    private CancellationTokenSource? _linkedCts;

    public ScalePollingHostedService(
        ScaleConfigurationService configurationService,
        ScaleBroadcastService broadcastService,
        ScaleServiceOptions options,
        ILoggerFactory loggerFactory,
        ILogger<ScalePollingHostedService> logger)
    {
        _configurationService = configurationService;
        _broadcastService = broadcastService;
        _options = options;
        _loggerFactory = loggerFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

        var configs = await _configurationService.GetActiveConfigurationsAsync(cancellationToken);
        if (configs.Count == 0)
        {
            _logger.LogWarning("Scale polling service started with no configurations. Will retry in background.");
            _ = Task.Run(() => RetryLoadAsync(_linkedCts.Token), _linkedCts.Token);
            return;
        }

        StartReaders(configs, _linkedCts.Token);
    }

    private void StartReaders(IReadOnlyList<ScaleConfiguration> configs, CancellationToken token)
    {
        if (_activeReaders.Count > 0)
        {
            return;
        }

        foreach (var config in configs)
        {
            var readerLogger = _loggerFactory.CreateLogger<SerialScaleReader>();
            var reader = new SerialScaleReader(config, _options, readerLogger);

            reader.WeightReceived += (_, snapshot) =>
            {
                _ = _broadcastService.BroadcastWeightAsync(snapshot, CancellationToken.None);
            };

            reader.StatusChanged += (_, status) =>
            {
                _ = _broadcastService.BroadcastStatusAsync(status, CancellationToken.None);
            };

            var task = Task.Run(() => reader.RunAsync(token), token);
            _activeReaders.Add((reader, task));
            _logger.LogInformation("Started scale reader for {ScaleId} on port {Port}", config.ScaleId ?? config.ControllerId, config.PortName);
        }
    }

    private async Task RetryLoadAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                var configs = await _configurationService.GetActiveConfigurationsAsync(token);
                if (configs.Count > 0)
                {
                    StartReaders(configs, token);
                    return;
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load scale configurations. Retrying...");
            }

            await Task.Delay(TimeSpan.FromSeconds(30), token);
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_linkedCts is not null)
        {
            await _linkedCts.CancelAsync();
            _linkedCts.Dispose();
            _linkedCts = null;
        }

        var readerTasks = _activeReaders.Select(tuple => tuple.task).ToArray();
        if (readerTasks.Length > 0)
        {
            try
            {
                await Task.WhenAll(readerTasks);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Reader task completed with exception");
            }
        }

        foreach (var (reader, _) in _activeReaders)
        {
            await reader.DisposeAsync();
        }

        _activeReaders.Clear();
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync(CancellationToken.None);
    }
}
