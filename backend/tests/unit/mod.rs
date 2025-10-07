// Unit Tests Module
// Constitutional compliance validation tests for core business logic
//
// Tests verify:
// - FEFO (First Expired, First Out) algorithm compliance
// - Weight tolerance validation (±INMAST.User9)
// - 4-phase atomic transaction execution
// - Audit trail preservation on rollback

pub mod fefo_tests;
pub mod validation_tests;
pub mod transaction_tests;
