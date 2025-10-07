// T083: Unit Tests for Weight Tolerance Validation
// Constitutional Compliance: Validates weight within ±INMAST.User9 tolerance
//
// Tests verify:
// 1. Weight within tolerance accepted
// 2. Weight below tolerance rejected
// 3. Weight above tolerance rejected
// 4. Tolerance calculation from INMAST.User9

use rust_decimal::Decimal;
use std::str::FromStr;

/// Weight tolerance validation result
#[derive(Debug, PartialEq)]
enum ValidationResult {
    Valid,
    BelowTolerance { actual: Decimal, min: Decimal },
    AboveTolerance { actual: Decimal, max: Decimal },
}

/// Validate weight against target with tolerance (matches backend validation logic)
fn validate_weight(
    actual_weight: Decimal,
    target_qty: Decimal,
    tolerance_kg: Decimal,
) -> ValidationResult {
    let weight_range_low = target_qty - tolerance_kg;
    let weight_range_high = target_qty + tolerance_kg;

    if actual_weight < weight_range_low {
        ValidationResult::BelowTolerance {
            actual: actual_weight,
            min: weight_range_low,
        }
    } else if actual_weight > weight_range_high {
        ValidationResult::AboveTolerance {
            actual: actual_weight,
            max: weight_range_high,
        }
    } else {
        ValidationResult::Valid
    }
}

/// Calculate weight range from target and tolerance (matches production formula)
fn calculate_weight_range(target_qty: Decimal, tolerance_kg: Decimal) -> (Decimal, Decimal) {
    let weight_range_low = target_qty - tolerance_kg;
    let weight_range_high = target_qty + tolerance_kg;
    (weight_range_low, weight_range_high)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test: Weight exactly at target (perfect pick) is accepted
    #[test]
    fn test_weight_exactly_at_target_accepted() {
        // Arrange: Production data pattern - INSALT02, 20 KG target, ±0.025 KG tolerance
        let target_qty = Decimal::from_str("20.0").unwrap();
        let tolerance_kg = Decimal::from_str("0.025").unwrap();
        let actual_weight = Decimal::from_str("20.0").unwrap(); // Exactly at target

        // Act: Validate weight
        let result = validate_weight(actual_weight, target_qty, tolerance_kg);

        // Assert: Weight accepted
        assert_eq!(result, ValidationResult::Valid);
    }

    /// Test: Weight within upper tolerance accepted
    #[test]
    fn test_weight_within_upper_tolerance_accepted() {
        // Arrange: Production data - target 20 KG, tolerance ±0.025 KG
        let target_qty = Decimal::from_str("20.0").unwrap();
        let tolerance_kg = Decimal::from_str("0.025").unwrap();
        let actual_weight = Decimal::from_str("20.025").unwrap(); // At upper bound

        // Act: Validate weight
        let result = validate_weight(actual_weight, target_qty, tolerance_kg);

        // Assert: Weight accepted (within tolerance)
        assert_eq!(result, ValidationResult::Valid);
    }

    /// Test: Weight within lower tolerance accepted
    #[test]
    fn test_weight_within_lower_tolerance_accepted() {
        // Arrange: Production data - target 20 KG, tolerance ±0.025 KG
        let target_qty = Decimal::from_str("20.0").unwrap();
        let tolerance_kg = Decimal::from_str("0.025").unwrap();
        let actual_weight = Decimal::from_str("19.975").unwrap(); // At lower bound

        // Act: Validate weight
        let result = validate_weight(actual_weight, target_qty, tolerance_kg);

        // Assert: Weight accepted (within tolerance)
        assert_eq!(result, ValidationResult::Valid);
    }

    /// Test: Weight above tolerance rejected
    #[test]
    fn test_weight_above_tolerance_rejected() {
        // Arrange: Production data - exceeding upper tolerance
        let target_qty = Decimal::from_str("20.0").unwrap();
        let tolerance_kg = Decimal::from_str("0.025").unwrap();
        let actual_weight = Decimal::from_str("20.026").unwrap(); // 0.001 KG over tolerance

        // Act: Validate weight
        let result = validate_weight(actual_weight, target_qty, tolerance_kg);

        // Assert: Weight rejected (above tolerance)
        match result {
            ValidationResult::AboveTolerance { actual, max } => {
                assert_eq!(actual, Decimal::from_str("20.026").unwrap());
                assert_eq!(max, Decimal::from_str("20.025").unwrap());
            }
            _ => panic!("Expected AboveTolerance, got {:?}", result),
        }
    }

    /// Test: Weight below tolerance rejected
    #[test]
    fn test_weight_below_tolerance_rejected() {
        // Arrange: Production data - below lower tolerance
        let target_qty = Decimal::from_str("20.0").unwrap();
        let tolerance_kg = Decimal::from_str("0.025").unwrap();
        let actual_weight = Decimal::from_str("19.974").unwrap(); // 0.001 KG under tolerance

        // Act: Validate weight
        let result = validate_weight(actual_weight, target_qty, tolerance_kg);

        // Assert: Weight rejected (below tolerance)
        match result {
            ValidationResult::BelowTolerance { actual, min } => {
                assert_eq!(actual, Decimal::from_str("19.974").unwrap());
                assert_eq!(min, Decimal::from_str("19.975").unwrap());
            }
            _ => panic!("Expected BelowTolerance, got {:?}", result),
        }
    }

    /// Test: Tolerance calculation matches production formula
    #[test]
    fn test_tolerance_calculation_from_inmast_user9() {
        // Arrange: Production INMAST.User9 values (tolerance in KG)
        let test_cases = vec![
            (
                Decimal::from_str("20.0").unwrap(),   // Target qty (INSALT02)
                Decimal::from_str("0.025").unwrap(),  // INMAST.User9 tolerance
                Decimal::from_str("19.975").unwrap(), // Expected low
                Decimal::from_str("20.025").unwrap(), // Expected high
            ),
            (
                Decimal::from_str("14.24").unwrap(),  // Target qty (INRICF05)
                Decimal::from_str("0.025").unwrap(),  // INMAST.User9 tolerance
                Decimal::from_str("14.215").unwrap(), // Expected low
                Decimal::from_str("14.265").unwrap(), // Expected high
            ),
            (
                Decimal::from_str("100.0").unwrap(), // Larger target
                Decimal::from_str("0.5").unwrap(),   // Larger tolerance
                Decimal::from_str("99.5").unwrap(),  // Expected low
                Decimal::from_str("100.5").unwrap(), // Expected high
            ),
        ];

        for (target_qty, tolerance_kg, expected_low, expected_high) in test_cases {
            // Act: Calculate weight range
            let (actual_low, actual_high) = calculate_weight_range(target_qty, tolerance_kg);

            // Assert: Matches production formula (ToPickedPartialQty ± User9)
            assert_eq!(
                actual_low, expected_low,
                "Low range mismatch for target {}",
                target_qty
            );
            assert_eq!(
                actual_high, expected_high,
                "High range mismatch for target {}",
                target_qty
            );
        }
    }

    /// Test: Zero tolerance requires exact weight match
    #[test]
    fn test_zero_tolerance_requires_exact_match() {
        // Arrange: Edge case - zero tolerance (strict exact weight)
        let target_qty = Decimal::from_str("20.0").unwrap();
        let tolerance_kg = Decimal::ZERO;

        // Act & Assert: Only exact match accepted
        assert_eq!(
            validate_weight(Decimal::from_str("20.0").unwrap(), target_qty, tolerance_kg),
            ValidationResult::Valid
        );
        assert_ne!(
            validate_weight(
                Decimal::from_str("20.001").unwrap(),
                target_qty,
                tolerance_kg
            ),
            ValidationResult::Valid
        );
        assert_ne!(
            validate_weight(
                Decimal::from_str("19.999").unwrap(),
                target_qty,
                tolerance_kg
            ),
            ValidationResult::Valid
        );
    }

    /// Test: Large tolerance allows wider weight range
    #[test]
    fn test_large_tolerance_allows_wider_range() {
        // Arrange: Large tolerance scenario (e.g., bulk materials)
        let target_qty = Decimal::from_str("500.0").unwrap();
        let tolerance_kg = Decimal::from_str("5.0").unwrap(); // ±1% tolerance

        // Act & Assert: Wide range accepted
        let test_weights = vec![
            (Decimal::from_str("495.0").unwrap(), true), // At lower bound
            (Decimal::from_str("494.9").unwrap(), false), // Below tolerance
            (Decimal::from_str("500.0").unwrap(), true), // Exact
            (Decimal::from_str("505.0").unwrap(), true), // At upper bound
            (Decimal::from_str("505.1").unwrap(), false), // Above tolerance
        ];

        for (weight, should_be_valid) in test_weights {
            let result = validate_weight(weight, target_qty, tolerance_kg);
            if should_be_valid {
                assert_eq!(
                    result,
                    ValidationResult::Valid,
                    "Weight {} should be valid",
                    weight
                );
            } else {
                assert_ne!(
                    result,
                    ValidationResult::Valid,
                    "Weight {} should be invalid",
                    weight
                );
            }
        }
    }

    /// Test: Precision handling with three decimal places (production requirement)
    #[test]
    fn test_precision_handling_three_decimals() {
        // Arrange: Production weight precision (0.001 KG = 1 gram)
        let target_qty = Decimal::from_str("20.000").unwrap();
        let tolerance_kg = Decimal::from_str("0.025").unwrap();

        // Act & Assert: Precision to 3 decimal places
        let test_weights = vec![
            ("19.975", true),  // Exactly at lower bound
            ("19.974", false), // 1 gram below
            ("20.025", true),  // Exactly at upper bound
            ("20.026", false), // 1 gram above
            ("20.000", true),  // Exact target
            ("20.012", true),  // Mid-range (valid)
        ];

        for (weight_str, should_be_valid) in test_weights {
            let weight = Decimal::from_str(weight_str).unwrap();
            let result = validate_weight(weight, target_qty, tolerance_kg);
            if should_be_valid {
                assert_eq!(
                    result,
                    ValidationResult::Valid,
                    "Weight {} should be valid",
                    weight_str
                );
            } else {
                assert_ne!(
                    result,
                    ValidationResult::Valid,
                    "Weight {} should be invalid",
                    weight_str
                );
            }
        }
    }

    /// Test: Negative weight always rejected (safety check)
    #[test]
    fn test_negative_weight_rejected() {
        // Arrange: Invalid negative weight
        let target_qty = Decimal::from_str("20.0").unwrap();
        let tolerance_kg = Decimal::from_str("0.025").unwrap();
        let actual_weight = Decimal::from_str("-1.0").unwrap(); // Invalid

        // Act: Validate weight
        let result = validate_weight(actual_weight, target_qty, tolerance_kg);

        // Assert: Negative weight rejected
        assert_ne!(result, ValidationResult::Valid);
        match result {
            ValidationResult::BelowTolerance { actual, min } => {
                assert!(actual < Decimal::ZERO);
                assert_eq!(min, Decimal::from_str("19.975").unwrap());
            }
            _ => panic!("Expected BelowTolerance, got {:?}", result),
        }
    }

    /// Test: Production scenario - INSALT02 with typical variance
    #[test]
    fn test_production_scenario_insalt02_typical_variance() {
        // Arrange: Real production data - INSALT02 salt picking
        // Target: 20 KG, Tolerance: ±0.025 KG (from INMAST.User9)
        let target_qty = Decimal::from_str("20.0").unwrap();
        let tolerance_kg = Decimal::from_str("0.025").unwrap();

        // Act & Assert: Typical scale readings
        let production_weights = vec![
            ("19.975", true),  // Lower bound (acceptable)
            ("19.980", true),  // Slightly under target
            ("19.995", true),  // Just under target
            ("20.000", true),  // Exact target
            ("20.005", true),  // Slightly over target
            ("20.020", true),  // Near upper bound
            ("20.025", true),  // Upper bound (acceptable)
            ("20.030", false), // 5 grams over (rejected)
            ("19.970", false), // 5 grams under (rejected)
        ];

        for (weight_str, expected_valid) in production_weights {
            let weight = Decimal::from_str(weight_str).unwrap();
            let result = validate_weight(weight, target_qty, tolerance_kg);
            let is_valid = result == ValidationResult::Valid;

            assert_eq!(
                is_valid, expected_valid,
                "Weight {} validation mismatch: expected {}, got {}",
                weight_str, expected_valid, is_valid
            );
        }
    }

    /// Test: Constitutional requirement - weight validation is non-negotiable
    #[test]
    fn test_constitutional_compliance_no_override_allowed() {
        // Arrange: Out-of-tolerance weight (constitutional principle: no manual override)
        let target_qty = Decimal::from_str("20.0").unwrap();
        let tolerance_kg = Decimal::from_str("0.025").unwrap();
        let out_of_tolerance_weight = Decimal::from_str("21.0").unwrap(); // 1 KG over

        // Act: Validate weight
        let result = validate_weight(out_of_tolerance_weight, target_qty, tolerance_kg);

        // Assert: Out-of-tolerance weight MUST be rejected (no override allowed)
        assert_ne!(result, ValidationResult::Valid);
        match result {
            ValidationResult::AboveTolerance { actual, max } => {
                assert_eq!(actual, Decimal::from_str("21.0").unwrap());
                assert_eq!(max, Decimal::from_str("20.025").unwrap());
                // Verify constitutional compliance - rejection is absolute
                assert!(
                    actual > max,
                    "Constitutional violation: weight > max tolerance"
                );
            }
            _ => panic!("Expected AboveTolerance rejection"),
        }
    }
}
