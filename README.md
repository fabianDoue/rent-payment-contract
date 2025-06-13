# Rent Payment Smart Contract

This repository contains a Clarity smart contract for automating rent payments between a landlord and tenant. The contract handles rent collection, late payment penalties, and security deposit management.

## Features

- **Automated Rent Payments**: Tenants can make rent payments directly through the contract
- **Late Payment Penalties**: Automatically applies penalties for late payments
- **Security Deposit Management**: Handles security deposit collection and return
- **Payment Tracking**: Records payment history for each month
- **Role-Based Access Control**: Different functions for landlord and tenant

## Contract Functions

### Initialization

- `initialize`: Sets up the contract with tenant address, rent amount, due date, and penalty percentage

### Payment Functions

- `pay-rent`: Allows tenant to pay rent for a specific month
- `pay-security-deposit`: Allows tenant to pay security deposit
- `return-security-deposit`: Allows landlord to return security deposit to tenant

### Administrative Functions

- `update-rent-amount`: Allows landlord to update the rent amount
- `change-tenant`: Allows landlord to change the tenant address

### Read-Only Functions

- `get-landlord`: Returns the landlord's address
- `get-tenant`: Returns the tenant's address
- `get-rent-amount`: Returns the current rent amount
- `get-rent-due-day`: Returns the day of the month when rent is due
- `get-penalty-percentage`: Returns the late payment penalty percentage
- `get-security-deposit`: Returns the security deposit amount
- `get-payment-status`: Returns payment status for a specific month

## Error Codes

- `ERR_UNAUTHORIZED (u1)`: Caller is not authorized to perform the action
- `ERR_INSUFFICIENT_FUNDS (u2)`: Insufficient funds for the transaction
- `ERR_ALREADY_PAID (u3)`: Rent for the specified period has already been paid
- `ERR_INVALID_AMOUNT (u4)`: Invalid amount specified
- `ERR_NOT_DUE (u5)`: Payment is not due yet

## Usage

1. Deploy the contract to the Stacks blockchain
2. Initialize the contract with tenant details and rent parameters
3. Tenant can make rent payments and pay security deposit
4. Landlord can update rent amount, change tenant, and return security deposit
