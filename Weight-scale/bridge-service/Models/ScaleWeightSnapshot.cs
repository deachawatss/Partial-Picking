using System;

namespace PK.BridgeService.Models;

public sealed class ScaleWeightSnapshot
{
    public required string ScaleId { get; init; }
    public required double Weight { get; init; }
    public required string Unit { get; init; }
    public required bool Stable { get; init; }
    public required DateTime TimestampUtc { get; init; }
}
