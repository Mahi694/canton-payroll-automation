/**
 * @file payrollService.ts
 * @description This file contains the service layer for interacting with the Canton
 * ledger's JSON API for the payroll application. It provides typed functions
 * for querying active contracts related to employees, pay periods, and deduction rules.
 */

// ==============================================================================
// TYPE DEFINITIONS
// ==============================================================================
// These interfaces define the shape of the Daml contract payloads as they are
// represented in JSON. Note that Daml types like `Decimal`, `Party`, and `Date`
// are serialized as strings.

/**
 * Represents the data payload of a `Payroll.Employee:Employee` contract.
 */
export interface Employee {
  hr: string;
  employee: string;
  employeeId: string;
  fullName: string;
  department: string;
  position: string;
  annualSalary: string; // Daml.Finance.Interface.Util.Numeric.I
  payFrequency: 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
  hireDate: string; // DA.Date.Date
}

/**
 * Represents the data payload of a `Payroll.PayPeriod:PayPeriod` contract,
 * which is the result of a payroll run for a single employee.
 */
export interface PayPeriod {
  hr: string;
  employee: string;
  employeeId: string;
  periodStartDate: string;
  periodEndDate: string;
  payDate: string;
  grossPay: string;
  netPay: string;
  deductions: { label: string; amount: string }[];
}

/**
 * Represents the data payload of a `Payroll.Rule.DeductionRule` contract.
 */
export interface DeductionRule {
  hr: string;
  ruleId: string;
  description: string;
  deductionType: 'FIXED_AMOUNT' | 'PERCENTAGE';
  value: string;
  appliesToAll: boolean;
}

/**
 * A generic type representing a Daml contract as returned by the JSON API.
 * @template T The type of the contract's payload.
 */
export interface DamlContract<T> {
  contractId: string;
  templateId: string;
  payload: T;
  agreementText: string;
}

// ==============================================================================
// SERVICE CONFIGURATION
// ==============================================================================

/**
 * The base URL for the Canton ledger's JSON API.
 * In a production environment, this should be loaded from environment variables
 * (e.g., using `process.env.REACT_APP_JSON_API_URL`).
 */
const JSON_API_URL = 'http://localhost:7575';

// ==============================================================================
// CORE API FUNCTIONS
// ==============================================================================

/**
 * A generic and reusable function to query the JSON API for active contracts
 * of a specific template visible to the authenticated party.
 * @param token - The JWT token for authenticating with the JSON API.
 * @param templateId - The full template ID string, e.g., "Payroll.Employee:Employee".
 * @returns A promise that resolves to an array of contracts of the specified type.
 * @throws An error if the network request or the API call fails.
 */
async function queryLedger<T>(token: string, templateId: string): Promise<DamlContract<T>[]> {
  try {
    const response = await fetch(`${JSON_API_URL}/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ templateIds: [templateId] }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error querying ledger for ${templateId}: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Failed to query ledger for ${templateId}. Status: ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== 200) {
      console.error(`Ledger API returned non-200 status in body for ${templateId}:`, data);
      throw new Error(`Ledger API error for ${templateId}: ${data.errors?.join(', ') || 'Unknown error'}`);
    }

    return data.result as DamlContract<T>[];
  } catch (error) {
    console.error(`Network or other error while querying for ${templateId}:`, error);
    // Re-throw the error so that UI components can handle it, e.g., by showing a notification.
    throw error;
  }
}

// ==============================================================================
// EXPORTED SERVICE METHODS
// ==============================================================================

/**
 * Fetches all active `Employee` contracts visible to the party associated with the token.
 * Typically used by an HR party to get a list of all employees.
 * @param token - The JWT token for authentication.
 * @returns A promise that resolves to an array of Employee contracts.
 */
export const fetchEmployees = async (token: string): Promise<DamlContract<Employee>[]> => {
  // NOTE: The template ID is hardcoded here. In a larger application, these could be
  // managed in a central configuration file or generated from the Daml models.
  const templateId = 'Payroll.Employee:Employee';
  return queryLedger<Employee>(token, templateId);
};

/**
 * Fetches all active `PayPeriod` contracts visible to the party associated with the token.
 * An HR party will see all pay periods, while an employee will only see their own.
 * @param token - The JWT token for authentication.
 * @returns A promise that resolves to an array of PayPeriod contracts.
 */
export const fetchPayPeriods = async (token: string): Promise<DamlContract<PayPeriod>[]> => {
  const templateId = 'Payroll.PayPeriod:PayPeriod';
  return queryLedger<PayPeriod>(token, templateId);
};

/**
 * Fetches all active `DeductionRule` contracts visible to the HR party.
 * @param token - The JWT token for an HR party.
 * @returns A promise that resolves to an array of DeductionRule contracts.
 */
export const fetchDeductionRules = async (token: string): Promise<DamlContract<DeductionRule>[]> => {
  const templateId = 'Payroll.Rule.DeductionRule';
  return queryLedger<DeductionRule>(token, templateId);
};

/**
 * Fetches pay periods for a specific employee by filtering the results client-side.
 * This is useful for an HR user who wants to view the history for one employee.
 * For large datasets, a backend with access to the Participant Query Store (PQS) would be more efficient.
 * @param token - The JWT token for authentication (should be an HR party).
 * @param employeePartyId - The party ID of the employee to filter by.
 * @returns A promise that resolves to an array of PayPeriod contracts for the specified employee.
 */
export const fetchPayPeriodsForEmployee = async (token: string, employeePartyId: string): Promise<DamlContract<PayPeriod>[]> => {
    const allPayPeriods = await fetchPayPeriods(token);
    return allPayPeriods.filter(pp => pp.payload.employee === employeePartyId);
}

/**
 * A consolidated service object that groups all the related API functions.
 * This can be imported and used conveniently in UI components.
 */
export const payrollService = {
  fetchEmployees,
  fetchPayPeriods,
  fetchPayPeriodsForEmployee,
  fetchDeductionRules,
};

export default payrollService;