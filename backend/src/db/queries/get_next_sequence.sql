-- Get Next Sequence Number
-- Atomically increment and retrieve next sequence number for PT (Pallet/Transaction)

-- CRITICAL: This query MUST be executed BEFORE Phase 1 and Phase 3
-- The returned sequence number is used for:
-- - Cust_PartialLotPicked.LotTranNo (Phase 1)
-- - LotTransaction.LotTranNo (Phase 3)

-- Parameters (Tiberius format):
-- @P1: SeqName (VARCHAR) - Sequence name (always 'PT' for partial picking)

-- STEP 1: Increment the sequence (ATOMIC - row-level lock)
UPDATE Seqnum
SET SeqNum = SeqNum + 1
WHERE SeqName = @P1;

-- STEP 2: Retrieve the new sequence number
SELECT SeqNum
FROM Seqnum
WHERE SeqName = @P1;

-- CRITICAL: Both UPDATE and SELECT must execute in same transaction
-- CRITICAL: Row-level lock on Seqnum ensures thread-safe sequence generation

-- Usage in Rust/Tiberius:
-- ```rust
-- let seq_name = "PT";
-- let mut tx = pool.begin().await?;
--
-- // Increment sequence
-- sqlx::query("UPDATE Seqnum SET SeqNum = SeqNum + 1 WHERE SeqName = @P1")
--     .bind(seq_name)
--     .execute(&mut tx)
--     .await?;
--
-- // Get new sequence number
-- let lot_tran_no: i32 = sqlx::query_scalar("SELECT SeqNum FROM Seqnum WHERE SeqName = @P1")
--     .bind(seq_name)
--     .fetch_one(&mut tx)
--     .await?;
--
-- // Use lot_tran_no in Phase 1 and Phase 3
-- // ...
--
-- tx.commit().await?;
-- ```

-- Alternative: Use stored procedure (if available)
-- DECLARE @NextValue INT;
-- EXEC usp_GetNextValue 'PT', @NextValue OUTPUT;
-- SELECT @NextValue AS SeqNum;

-- Sequence information:
-- - SeqName: 'PT' (Pallet/Transaction sequence)
-- - Description: "Last Used Number for Pallet"
-- - Current value (as of 2025-10-07): 623956
-- - Increments by: 1

-- Performance note: Row-level lock ensures atomicity but can cause contention
-- Expected execution time: <5ms
-- Expected rows: 1
