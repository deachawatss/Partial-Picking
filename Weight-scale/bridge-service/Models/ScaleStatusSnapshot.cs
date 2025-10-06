namespace PK.BridgeService.Models;

public sealed class ScaleStatusSnapshot
{
    public required string ScaleId { get; init; }
    public bool Connected { get; init; }
    public string? PortName { get; init; }
    public string? Error { get; init; }
}
