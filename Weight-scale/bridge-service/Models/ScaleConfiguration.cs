namespace PK.BridgeService.Models;

public sealed class ScaleConfiguration
{
    public required string ControllerId { get; init; }
    public required string PortName { get; init; }
    public int BaudRate { get; init; } = 9600;
    public int DataBits { get; init; } = 8;
    public string Parity { get; init; } = "None";
    public string StopBits { get; init; } = "One";
    public string? ScaleId { get; init; }
    public string? WorkstationName { get; init; }
    public string? NativePortName { get; init; }

    /// <summary>
    /// Scale type classification: "SMALL" (0-5kg) or "BIG" (0-100kg)
    /// </summary>
    public string ScaleType { get; init; } = "BIG";
}
