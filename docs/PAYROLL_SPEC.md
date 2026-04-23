# Canton Payroll Automation: Calculation Specification

This document outlines the specification for payroll calculations within the Canton Payroll Automation system. The Daml smart contracts will implement this logic to ensure accurate and transparent net pay computation.

## 1. Overview

The payroll process calculates an employee's net pay for a given pay period. The calculation starts with the employee's gross compensation, subtracts various deductions in a specific order, and arrives at the final net amount to be disbursed. The entire process is designed to be auditable and atomic on the Canton network.

## 2. Key Concepts

-   **Employer:** The legal entity responsible for paying salaries and managing payroll.
-   **Employee:** An individual receiving compensation for services rendered.
-   **Compensation Package:** A contract defining the employee's annual salary, allowances, and other compensation terms.
-   **Pay Period:** The frequency at which employees are paid (e.g., monthly, bi-weekly). For this specification, we assume a **monthly** pay period.
-   **Gross Pay:** The total amount of an employee's earnings before any deductions are taken out for a specific pay period.
-   **Deductions:** Amounts subtracted from gross pay, categorized as statutory, pre-tax, and post-tax.
-   **Taxable Income:** The portion of gross pay subject to taxation after pre-tax deductions are applied.
-   **Net Pay:** The final "take-home" pay for an employee after all deductions and taxes have been subtracted.

## 3. Payroll Calculation Formula

The core formula for calculating net pay is as follows:

1.  **Calculate Period Gross Pay:**
    `Period Gross Pay = (Annual Base Salary / 12) + Period Allowances + Period Bonuses`

2.  **Calculate Taxable Income:**
    `Taxable Income = Period Gross Pay - Pre-Tax Deductions`

3.  **Calculate Total Taxes:**
    `Total Taxes = Federal Income Tax + State Income Tax + Social Security Tax`

4.  **Calculate Net Pay:**
    `Net Pay = Period Gross Pay - Pre-Tax Deductions - Total Taxes - Post-Tax Deductions`

This can be simplified to: `Net Pay = Taxable Income - Total Taxes - Post-Tax Deductions`

## 4. Deduction Categories & Rates

Deductions are applied in a specific order. The rates below are illustrative and will be configured per `CompensationPackage` and `PayrollRun`.

### 4.1. Pre-Tax Deductions

These deductions are subtracted from Gross Pay *before* calculating income taxes.

-   **Retirement Plan Contribution:** A fixed percentage of the Period Gross Pay.
    -   *Example Rate:* 5.0%
-   **Health Insurance Premium:** A fixed decimal amount per pay period.
    -   *Example Amount:* 250.00

### 4.2. Statutory Deductions (Taxes)

These are calculated based on the `Taxable Income`.

-   **Federal Income Tax (Progressive):** Applied in brackets to the *annualized* taxable income, then divided by 12.
    -   `Annualized Taxable Income = Taxable Income * 12`
    -   **Brackets:**
        -   10% on income up to 11,000.00
        -   12% on income over 11,000.00 up to 44,725.00
        -   22% on income over 44,725.00 up to 95,375.00
        -   24% on income over 95,375.00
    -   `Period Federal Tax = (Calculated Annual Federal Tax) / 12`

-   **State Income Tax (Flat):** A flat percentage of the `Taxable Income`.
    -   *Example Rate:* 3.5%

-   **Social Security Tax:** A percentage of `Period Gross Pay`, up to an annual maximum wage base.
    -   *Example Rate:* 6.2%
    -   *Annual Wage Base Maximum:* 168,600.00
    -   *Calculation Note:* The system must track year-to-date (YTD) earnings to cap this deduction correctly. For this spec, we will simplify and assume the annual cap is not yet reached.

### 4.3. Post-Tax Deductions

These deductions are subtracted from pay *after* all taxes have been calculated.

-   **Loan Repayment:** A fixed decimal amount per pay period.
    -   *Example Amount:* 150.00

## 5. Example Calculation

Let's walk through an example for a single employee for one monthly pay period.

**Employee Compensation Data:**

-   **Annual Base Salary:** 90,000.00
-   **Retirement Contribution:** 5.0% (Pre-Tax)
-   **Health Insurance Premium:** 250.00 (Pre-Tax)
-   **Loan Repayment:** 150.00 (Post-Tax)

---

**Step 1: Calculate Period Gross Pay**

-   `Period Gross Pay = 90,000.00 / 12 = 7,500.00`

**Step 2: Calculate Pre-Tax Deductions**

-   `Retirement Contribution = 7,500.00 * 5.0% = 375.00`
-   `Health Insurance Premium = 250.00`
-   **Total Pre-Tax Deductions = 375.00 + 250.00 = 625.00**

**Step 3: Calculate Taxable Income**

-   `Taxable Income = 7,500.00 - 625.00 = 6,875.00`

**Step 4: Calculate Taxes**

-   **Federal Income Tax:**
    -   `Annualized Taxable Income = 6,875.00 * 12 = 82,500.00`
    -   Tax on first 11,000.00: `11,000.00 * 10% = 1,100.00`
    -   Tax on next bracket (44,725 - 11,000): `33,725.00 * 12% = 4,047.00`
    -   Tax on final bracket (82,500 - 44,725): `37,775.00 * 22% = 8,310.50`
    -   `Total Annual Federal Tax = 1,100.00 + 4,047.00 + 8,310.50 = 13,457.50`
    -   `Period Federal Tax = 13,457.50 / 12 = 1,121.46` (rounded)

-   **State Income Tax:**
    -   `Period State Tax = 6,875.00 * 3.5% = 240.63` (rounded)

-   **Social Security Tax:**
    -   `Period Social Security Tax = 7,500.00 * 6.2% = 465.00`

-   **Total Taxes = 1,121.46 + 240.63 + 465.00 = 1,827.09**

**Step 5: Calculate Post-Tax Deductions**

-   `Loan Repayment = 150.00`
-   **Total Post-Tax Deductions = 150.00**

**Step 6: Calculate Final Net Pay**

-   `Net Pay = Taxable Income - Total Taxes - Post-Tax Deductions`
-   `Net Pay = 6,875.00 - 1,827.09 - 150.00 = 4,897.91`

---

### **Final Payslip Summary:**

| Item                        | Amount      |
| --------------------------- | ----------- |
| **Gross Pay**               | **7,500.00**  |
| ---                         | ---         |
| **Pre-Tax Deductions**      |             |
| Retirement Plan             | (375.00)    |
| Health Insurance            | (250.00)    |
| **Taxable Income**          | **6,875.00**  |
| ---                         | ---         |
| **Taxes**                   |             |
| Federal Income Tax          | (1,121.46)  |
| State Income Tax            | (240.63)    |
| Social Security Tax         | (465.00)    |
| ---                         | ---         |
| **Post-Tax Deductions**     |             |
| Loan Repayment              | (150.00)    |
| ---                         | ---         |
| **Net Pay**                 | **4,897.91**  |