using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PK.BridgeService.Models;

namespace PK.BridgeService.Services;

public sealed class ScaleBroadcastService
{
    // Track clients with their scale type subscription (SMALL or BIG)
    private readonly ConcurrentDictionary<Guid, (WebSocket Socket, string ScaleType)> _clients = new();
    private readonly ConcurrentDictionary<string, ScaleStatusSnapshot> _lastStatuses = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, ScaleWeightSnapshot> _lastWeights = new(StringComparer.OrdinalIgnoreCase);
    private readonly ILogger<ScaleBroadcastService> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public ScaleBroadcastService(ILogger<ScaleBroadcastService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Register a WebSocket client with scale type subscription
    /// </summary>
    /// <param name="webSocket">The WebSocket connection</param>
    /// <param name="scaleType">Scale type: "SMALL" or "BIG"</param>
    /// <returns>Client ID</returns>
    public Guid Register(WebSocket webSocket, string scaleType)
    {
        var id = Guid.NewGuid();
        _clients[id] = (webSocket, scaleType.ToUpper());
        _logger.LogInformation("Client {ClientId} connected to {ScaleType} scale. Active clients: {Count}",
            id, scaleType.ToUpper(), _clients.Count);
        return id;
    }

    public void Unregister(Guid clientId)
    {
        if (_clients.TryRemove(clientId, out var client))
        {
            _logger.LogInformation("Client {ClientId} ({ScaleType}) disconnected. Active clients: {Count}",
                clientId, client.ScaleType, _clients.Count);
        }
    }

    public async Task HandleClientAsync(Guid clientId, WebSocket webSocket, string scaleType, CancellationToken cancellationToken)
    {
        var buffer = new byte[1024];

        try
        {
            // Send initial state filtered by scale type
            await SendInitialStateAsync(webSocket, scaleType, cancellationToken);

            while (!cancellationToken.IsCancellationRequested && webSocket.State == WebSocketState.Open)
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    break;
                }

                // Currently we do not process inbound messages; future commands can be handled here.
            }
        }
        catch (OperationCanceledException)
        {
            // Ignored
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WebSocket client {ClientId} ({ScaleType}) failed", clientId, scaleType);
        }
        finally
        {
            Unregister(clientId);
            if (webSocket.State is WebSocketState.Open or WebSocketState.CloseReceived)
            {
                await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
            }
        }
    }

    public async Task BroadcastWeightAsync(ScaleWeightSnapshot snapshot, CancellationToken cancellationToken)
    {
        _lastWeights[snapshot.ScaleId] = snapshot;

        // Count clients subscribed to this scale type
        var subscribedClients = _clients.Values.Count(c =>
            c.ScaleType.Equals(snapshot.ScaleId, StringComparison.OrdinalIgnoreCase));

        _logger.LogInformation("Broadcasting weight for {ScaleId}: {Weight} {Unit} (stable: {Stable}) to {ClientCount} client(s)",
            snapshot.ScaleId, snapshot.Weight, snapshot.Unit, snapshot.Stable, subscribedClients);

        var payload = BuildWeightPayload(snapshot);
        await BroadcastAsync(payload, snapshot.ScaleId, cancellationToken);
    }

    public async Task BroadcastStatusAsync(ScaleStatusSnapshot status, CancellationToken cancellationToken)
    {
        _lastStatuses[status.ScaleId] = status;
        _logger.LogInformation("Broadcasting status for {ScaleId}: connected={Connected} error={Error}",
            status.ScaleId, status.Connected, status.Error);

        var payload = BuildStatusPayload(status);
        await BroadcastAsync(payload, status.ScaleId, cancellationToken);
    }

    /// <summary>
    /// Send initial state to a new client, filtered by scale type
    /// </summary>
    public async Task SendInitialStateAsync(WebSocket socket, string scaleType, CancellationToken cancellationToken)
    {
        // Filter status by scale type
        foreach (var status in _lastStatuses.Values.Where(s =>
            s.ScaleId.Equals(scaleType, StringComparison.OrdinalIgnoreCase)))
        {
            await SendAsync(socket, BuildStatusPayload(status), cancellationToken);
        }

        // Filter weights by scale type
        foreach (var weight in _lastWeights.Values.Where(w =>
            w.ScaleId.Equals(scaleType, StringComparison.OrdinalIgnoreCase)))
        {
            await SendAsync(socket, BuildWeightPayload(weight), cancellationToken);
        }
    }

    /// <summary>
    /// Broadcast to clients subscribed to a specific scale type
    /// </summary>
    private async Task BroadcastAsync(object payload, string scaleType, CancellationToken cancellationToken)
    {
        if (_clients.IsEmpty)
        {
            return;
        }

        // Only broadcast to clients subscribed to this scale type
        foreach (var (clientId, (socket, clientScaleType)) in _clients.ToArray())
        {
            if (!clientScaleType.Equals(scaleType, StringComparison.OrdinalIgnoreCase))
            {
                continue; // Skip clients not subscribed to this scale type
            }

            if (socket.State != WebSocketState.Open)
            {
                Unregister(clientId);
                continue;
            }

            try
            {
                await SendAsync(socket, payload, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed broadcasting to client {ClientId} ({ScaleType}). Removing connection",
                    clientId, clientScaleType);
                Unregister(clientId);
            }
        }
    }

    private Task SendAsync(WebSocket socket, object payload, CancellationToken cancellationToken)
    {
        var messageBytes = JsonSerializer.SerializeToUtf8Bytes(payload, _jsonOptions);
        return socket.SendAsync(new ArraySegment<byte>(messageBytes), WebSocketMessageType.Text, true, cancellationToken);
    }

    private static object BuildWeightPayload(ScaleWeightSnapshot snapshot)
    {
        return new
        {
            type = "weight",
            data = new
            {
                scaleId = snapshot.ScaleId,
                weight = snapshot.Weight,
                unit = snapshot.Unit,
                stable = snapshot.Stable,
                timestamp = new DateTimeOffset(snapshot.TimestampUtc).ToUnixTimeMilliseconds()
            }
        };
    }

    private static object BuildStatusPayload(ScaleStatusSnapshot status)
    {
        return new
        {
            type = "status",
            data = new
            {
                scaleId = status.ScaleId,
                connected = status.Connected,
                port = status.PortName,
                error = status.Error
            }
        };
    }
}
