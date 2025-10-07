// T082: Unit Tests for FEFO (First Expired, First Out) Algorithm
// Constitutional Compliance: Validates FEFO lot selection sorting by DateExpiry ASC
//
// Tests verify:
// 1. Lots sorted by DateExpiry ASC, Location ASC (FEFO principle)
// 2. Lots with insufficient quantity excluded
// 3. Only TFC1 location included (511 PARTIAL bins)
// 4. FEFO compliance with real production data patterns

use chrono::NaiveDate;
use rust_decimal::Decimal;
use std::str::FromStr;

/// Mock LotMaster record for testing FEFO algorithm
#[derive(Debug, Clone, PartialEq)]
struct LotMasterRecord {
    lot_no: String,
    item_key: String,
    bin_no: String,
    location: String,
    qty_on_hand: Decimal,
    qty_commit_sales: Decimal,
    date_expiry: NaiveDate,
    lot_status: Option<String>,
}

impl LotMasterRecord {
    fn available_qty(&self) -> Decimal {
        self.qty_on_hand - self.qty_commit_sales
    }
}

/// FEFO sorting algorithm matching production SQL query
fn apply_fefo_sort(mut lots: Vec<LotMasterRecord>) -> Vec<LotMasterRecord> {
    lots.sort_by(|a, b| {
        // Primary sort: DateExpiry ASC (FEFO principle)
        match a.date_expiry.cmp(&b.date_expiry) {
            std::cmp::Ordering::Equal => {
                // Secondary sort: Location ASC (for deterministic ordering)
                a.location.cmp(&b.location)
            }
            other => other,
        }
    });
    lots
}

/// Filter lots matching production SQL WHERE clause
fn filter_available_lots(
    lots: Vec<LotMasterRecord>,
    item_key: &str,
    min_qty: Decimal,
) -> Vec<LotMasterRecord> {
    lots.into_iter()
        .filter(|lot| {
            // Filter conditions from production SQL:
            // 1. ItemKey matches
            lot.item_key == item_key
                // 2. Location is TFC1 (constitutional requirement)
                && lot.location == "TFC1"
                // 3. Available quantity > 0 and >= min_qty
                && lot.available_qty() > Decimal::ZERO
                && lot.available_qty() >= min_qty
                // 4. LotStatus is P (Pass), C, or NULL
                && lot.lot_status.as_ref().map_or(true, |s| {
                    s == "P" || s == "C" || s.is_empty()
                })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test: FEFO sorting prioritizes earliest expiry date
    #[test]
    fn test_fefo_sort_by_expiry_date_ascending() {
        // Arrange: Create lots with different expiry dates
        let lots = vec![
            LotMasterRecord {
                lot_no: "LOT003".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBA-01".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("1000.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2028, 1, 5).unwrap(), // Latest
                lot_status: Some("P".to_string()),
            },
            LotMasterRecord {
                lot_no: "LOT001".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-12".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("500.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 6, 15).unwrap(), // Middle
                lot_status: Some("P".to_string()),
            },
            LotMasterRecord {
                lot_no: "LOT002".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-10".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("750.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 12, 16).unwrap(), // Earliest production data
                lot_status: Some("P".to_string()),
            },
        ];

        // Act: Apply FEFO sort
        let sorted = apply_fefo_sort(lots);

        // Assert: Earliest expiry date comes first (FEFO compliance)
        assert_eq!(sorted[0].lot_no, "LOT001"); // 2027-06-15 (earliest)
        assert_eq!(sorted[1].lot_no, "LOT002"); // 2027-12-16 (middle)
        assert_eq!(sorted[2].lot_no, "LOT003"); // 2028-01-05 (latest)

        // Verify dates are in ascending order
        assert!(sorted[0].date_expiry < sorted[1].date_expiry);
        assert!(sorted[1].date_expiry < sorted[2].date_expiry);
    }

    /// Test: FEFO uses Location as secondary sort when expiry dates match
    #[test]
    fn test_fefo_secondary_sort_by_location() {
        // Arrange: Lots with same expiry date, different locations
        let lots = vec![
            LotMasterRecord {
                lot_no: "LOT002".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-12".to_string(),
                location: "TFC1-Z".to_string(), // Later alphabetically
                qty_on_hand: Decimal::from_str("500.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 12, 16).unwrap(),
                lot_status: Some("P".to_string()),
            },
            LotMasterRecord {
                lot_no: "LOT001".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-10".to_string(),
                location: "TFC1-A".to_string(), // Earlier alphabetically
                qty_on_hand: Decimal::from_str("750.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 12, 16).unwrap(), // Same date
                lot_status: Some("P".to_string()),
            },
        ];

        // Act: Apply FEFO sort
        let sorted = apply_fefo_sort(lots);

        // Assert: When expiry dates match, location ascending determines order
        assert_eq!(sorted[0].lot_no, "LOT001"); // TFC1-A
        assert_eq!(sorted[1].lot_no, "LOT002"); // TFC1-Z
        assert!(sorted[0].location < sorted[1].location);
    }

    /// Test: Filter excludes lots with insufficient available quantity
    #[test]
    fn test_filter_excludes_insufficient_quantity() {
        // Arrange: Lots with varying available quantities
        let lots = vec![
            LotMasterRecord {
                lot_no: "LOT001".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-12".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("100.0").unwrap(),
                qty_commit_sales: Decimal::from_str("90.0").unwrap(), // Available: 10 KG
                date_expiry: NaiveDate::from_ymd_opt(2027, 12, 16).unwrap(),
                lot_status: Some("P".to_string()),
            },
            LotMasterRecord {
                lot_no: "LOT002".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBA-01".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("50.0").unwrap(),
                qty_commit_sales: Decimal::ZERO, // Available: 50 KG
                date_expiry: NaiveDate::from_ymd_opt(2027, 6, 15).unwrap(), // Earlier expiry
                lot_status: Some("P".to_string()),
            },
        ];

        // Act: Filter for min_qty = 20 KG
        let filtered = filter_available_lots(lots, "INSALT02", Decimal::from_str("20.0").unwrap());

        // Assert: Only LOT002 has sufficient available quantity (50 >= 20)
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].lot_no, "LOT002");
        assert_eq!(
            filtered[0].available_qty(),
            Decimal::from_str("50.0").unwrap()
        );
    }

    /// Test: Filter includes only TFC1 location (constitutional requirement)
    #[test]
    fn test_filter_includes_only_tfc1_location() {
        // Arrange: Lots from different locations
        let lots = vec![
            LotMasterRecord {
                lot_no: "LOT001".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-12".to_string(),
                location: "TFC1".to_string(), // Valid
                qty_on_hand: Decimal::from_str("500.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 12, 16).unwrap(),
                lot_status: Some("P".to_string()),
            },
            LotMasterRecord {
                lot_no: "LOT002".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "OTHERBIN".to_string(),
                location: "TFC2".to_string(), // Invalid - different warehouse
                qty_on_hand: Decimal::from_str("1000.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 6, 15).unwrap(),
                lot_status: Some("P".to_string()),
            },
            LotMasterRecord {
                lot_no: "LOT003".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "MAIN-01".to_string(),
                location: "MAIN".to_string(), // Invalid - main warehouse
                qty_on_hand: Decimal::from_str("750.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 1, 1).unwrap(), // Earliest expiry
                lot_status: Some("P".to_string()),
            },
        ];

        // Act: Filter
        let filtered = filter_available_lots(lots, "INSALT02", Decimal::ZERO);

        // Assert: Only TFC1 location included (constitutional requirement)
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].lot_no, "LOT001");
        assert_eq!(filtered[0].location, "TFC1");
    }

    /// Test: Filter excludes lots with zero or negative available quantity
    #[test]
    fn test_filter_excludes_zero_available_quantity() {
        // Arrange: Lots with no available inventory
        let lots = vec![
            LotMasterRecord {
                lot_no: "LOT001".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-12".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("100.0").unwrap(),
                qty_commit_sales: Decimal::from_str("100.0").unwrap(), // Available: 0
                date_expiry: NaiveDate::from_ymd_opt(2027, 12, 16).unwrap(),
                lot_status: Some("P".to_string()),
            },
            LotMasterRecord {
                lot_no: "LOT002".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBA-01".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("50.0").unwrap(),
                qty_commit_sales: Decimal::from_str("60.0").unwrap(), // Available: -10
                date_expiry: NaiveDate::from_ymd_opt(2027, 6, 15).unwrap(),
                lot_status: Some("P".to_string()),
            },
        ];

        // Act: Filter
        let filtered = filter_available_lots(lots, "INSALT02", Decimal::ZERO);

        // Assert: No lots with available quantity
        assert_eq!(filtered.len(), 0);
    }

    /// Test: Filter includes only allowed LotStatus values (P, C, empty/NULL)
    #[test]
    fn test_filter_includes_only_allowed_lot_status() {
        // Arrange: Lots with different statuses
        let lots = vec![
            LotMasterRecord {
                lot_no: "LOT001".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-12".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("500.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 12, 16).unwrap(),
                lot_status: Some("P".to_string()), // Pass - allowed
            },
            LotMasterRecord {
                lot_no: "LOT002".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBA-01".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("750.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 6, 15).unwrap(),
                lot_status: Some("H".to_string()), // Hold - NOT allowed
            },
            LotMasterRecord {
                lot_no: "LOT003".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBC-01".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("1000.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 1, 1).unwrap(),
                lot_status: None, // NULL - allowed
            },
            LotMasterRecord {
                lot_no: "LOT004".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBD-01".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("250.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 3, 1).unwrap(),
                lot_status: Some("C".to_string()), // C - allowed
            },
        ];

        // Act: Filter
        let filtered = filter_available_lots(lots, "INSALT02", Decimal::ZERO);

        // Assert: Only P, C, and NULL status lots included
        assert_eq!(filtered.len(), 3);
        assert!(filtered.iter().any(|l| l.lot_no == "LOT001"));
        assert!(filtered.iter().any(|l| l.lot_no == "LOT003"));
        assert!(filtered.iter().any(|l| l.lot_no == "LOT004"));
        assert!(!filtered.iter().any(|l| l.lot_no == "LOT002")); // H status excluded
    }

    /// Test: Complete FEFO workflow with production data pattern
    #[test]
    fn test_complete_fefo_workflow_with_production_data() {
        // Arrange: Real production data pattern (INSALT02 item, multiple lots)
        let lots = vec![
            LotMasterRecord {
                lot_no: "2510591-2".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBA-01".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("1250.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2028, 1, 5).unwrap(), // Later expiry
                lot_status: Some("P".to_string()),
            },
            LotMasterRecord {
                lot_no: "2510403-1".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-12".to_string(),
                location: "TFC1".to_string(),
                qty_on_hand: Decimal::from_str("4284.73").unwrap(),
                qty_commit_sales: Decimal::from_str("3715.81").unwrap(), // Available: 568.92
                date_expiry: NaiveDate::from_ymd_opt(2027, 12, 16).unwrap(), // Earlier expiry (FEFO)
                lot_status: Some("P".to_string()),
            },
            LotMasterRecord {
                lot_no: "2510100-5".to_string(),
                item_key: "INSALT02".to_string(),
                bin_no: "PWBB-10".to_string(),
                location: "TFC2".to_string(), // Wrong location - excluded
                qty_on_hand: Decimal::from_str("5000.0").unwrap(),
                qty_commit_sales: Decimal::ZERO,
                date_expiry: NaiveDate::from_ymd_opt(2027, 6, 1).unwrap(), // Earliest expiry
                lot_status: Some("P".to_string()),
            },
        ];

        // Act: Filter and sort (complete FEFO workflow)
        let min_qty = Decimal::from_str("20.0").unwrap(); // Typical pick requirement
        let filtered = filter_available_lots(lots, "INSALT02", min_qty);
        let sorted = apply_fefo_sort(filtered);

        // Assert: FEFO compliance - earliest TFC1 lot comes first
        assert_eq!(sorted.len(), 2); // Only TFC1 lots
        assert_eq!(sorted[0].lot_no, "2510403-1"); // Earliest TFC1 expiry (2027-12-16)
        assert_eq!(sorted[1].lot_no, "2510591-2"); // Later expiry (2028-01-05)

        // Verify constitutional requirements
        assert_eq!(sorted[0].location, "TFC1"); // TFC1 location enforced
        assert!(sorted[0].available_qty() >= min_qty); // Sufficient quantity
        assert_eq!(sorted[0].lot_status.as_ref().unwrap(), "P"); // Pass status
        assert!(sorted[0].date_expiry < sorted[1].date_expiry); // FEFO order
    }
}
