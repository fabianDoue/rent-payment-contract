;; rent-payment.clar
;; A contract for managing rent payments between a landlord and tenant

;; Define error codes
(define-constant ERR_UNAUTHORIZED (err u1000))
(define-constant ERR_INSUFFICIENT_FUNDS (err u1001))
(define-constant ERR_ALREADY_PAID (err u1002))
(define-constant ERR_INVALID_AMOUNT (err u1003))
(define-constant ERR_NOT_DUE (err u1004))

;; Define data variables
(define-data-var landlord principal tx-sender)
(define-data-var tenant (optional principal) none)
(define-data-var rent-amount uint u0)
(define-data-var rent-due-day uint u1)
(define-data-var penalty-percentage uint u5) ;; 5% penalty
(define-data-var security-deposit uint u0)
(define-data-var current-period uint u0)  ;; Use a simple counter instead of block height

;; Map to track payment status for each period
(define-map payment-status
  { period: uint }
  { paid: bool, amount-paid: uint, late: bool }
)

;; Getter functions
(define-read-only (get-landlord)
  (var-get landlord)
)

(define-read-only (get-tenant)
  (var-get tenant)
)

(define-read-only (get-rent-amount)
  (var-get rent-amount)
)

(define-read-only (get-rent-due-day)
  (var-get rent-due-day)
)

(define-read-only (get-penalty-percentage)
  (var-get penalty-percentage)
)

(define-read-only (get-security-deposit)
  (var-get security-deposit)
)

(define-read-only (get-current-period)
  (var-get current-period)
)

(define-read-only (get-payment-status (period uint))
  (default-to
    { paid: false, amount-paid: u0, late: false }
    (map-get? payment-status { period: period })
  )
)

;; Check if the caller is the landlord
(define-private (is-landlord)
  (is-eq tx-sender (var-get landlord))
)

;; Check if the caller is the tenant
(define-private (is-tenant)
  (match (var-get tenant) tenant-principal (is-eq tx-sender tenant-principal) false)
)

;; Calculate penalty amount
(define-private (calculate-penalty)
  (let (
    (base-rent (var-get rent-amount))
    (penalty-rate (var-get penalty-percentage))
  )
    (/ (* base-rent penalty-rate) u100)
  )
)

;; Initialize the contract
(define-public (initialize (new-tenant principal) (new-rent-amount uint) (new-rent-due-day uint) (new-penalty-percentage uint))
  (begin
    (asserts! (is-landlord) (err ERR_UNAUTHORIZED))
    (asserts! (> new-rent-amount u0) (err ERR_INVALID_AMOUNT))
    (asserts! (and (> new-rent-due-day u0) (<= new-rent-due-day u28)) (err ERR_INVALID_AMOUNT))

    (var-set tenant (some new-tenant))
    (var-set rent-amount new-rent-amount)
    (var-set rent-due-day new-rent-due-day)
    (var-set penalty-percentage new-penalty-percentage)
    (var-set current-period u1)  ;; Start with period 1

    (ok true)
  )
)

;; Pay rent for the current period
(define-public (pay-rent (is-late bool))
  (let (
    (current-period-val (var-get current-period))
    (payment-info (get-payment-status current-period-val))
    (base-amount (var-get rent-amount))
    (final-payment-amount (if is-late
                             (+ base-amount (calculate-penalty))
                             base-amount))
  )
    (asserts! (is-tenant) (err ERR_UNAUTHORIZED))
    (asserts! (not (get paid payment-info)) (err ERR_ALREADY_PAID))

    ;; Process payment - handle the response directly
    (match (stx-transfer? final-payment-amount tx-sender (var-get landlord))
      success
        (begin
          ;; Update payment status
          (map-set payment-status
            { period: current-period-val }
            { paid: true, amount-paid: final-payment-amount, late: is-late }
          )

          ;; Increment the period for next payment
          (var-set current-period (+ current-period-val u1))

          (ok final-payment-amount)
        )
      error (err ERR_INSUFFICIENT_FUNDS)
    )
  )
)

;; Pay security deposit
(define-public (pay-security-deposit (amount uint))
  (begin
    (asserts! (is-tenant) (err ERR_UNAUTHORIZED))
    (asserts! (> amount u0) (err ERR_INVALID_AMOUNT))

    ;; Transfer security deposit to landlord - handle the response directly
    (match (stx-transfer? amount tx-sender (var-get landlord))
      success
        (begin
          ;; Update security deposit amount
          (var-set security-deposit amount)
          (ok amount)
        )
      error (err ERR_INSUFFICIENT_FUNDS)
    )
  )
)

;; Return security deposit to tenant
(define-public (return-security-deposit)
  (let (
    (deposit-amount (var-get security-deposit))
    (tenant-principal (unwrap! (var-get tenant) (err ERR_UNAUTHORIZED)))
  )
    (asserts! (is-landlord) (err ERR_UNAUTHORIZED))
    (asserts! (> deposit-amount u0) (err ERR_INVALID_AMOUNT))

    ;; Transfer security deposit back to tenant - handle the response directly
    (match (stx-transfer? deposit-amount tx-sender tenant-principal)
      success
        (begin
          ;; Reset security deposit
          (var-set security-deposit u0)
          (ok deposit-amount)
        )
      error (err ERR_INSUFFICIENT_FUNDS)
    )
  )
)

;; Update rent amount (only landlord can do this)
(define-public (update-rent-amount (new-amount uint))
  (begin
    (asserts! (is-landlord) (err ERR_UNAUTHORIZED))
    (asserts! (> new-amount u0) (err ERR_INVALID_AMOUNT))

    (var-set rent-amount new-amount)

    (ok new-amount)
  )
)

;; Change tenant (only landlord can do this)
(define-public (change-tenant (new-tenant principal))
  (begin
    (asserts! (is-landlord) (err ERR_UNAUTHORIZED))

    (var-set tenant (some new-tenant))

    (ok true)
  )
)
