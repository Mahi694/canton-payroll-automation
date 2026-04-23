import React from 'react';

/**
 * Represents a single item in the deductions list of a payslip.
 */
export interface Deduction {
  name: string;
  amount: number;
}

/**
 * The full data structure for a payslip, typically derived from on-ledger contracts.
 */
export interface Payslip {
  id: string; // Could be a contract ID or a unique identifier
  employeeName: string;
  employerName: string;
  payPeriodStart: string; // ISO 8601 date string
  payPeriodEnd: string;   // ISO 8601 date string
  payDate: string;        // ISO 8601 date string
  grossPay: number;
  deductions: Deduction[];
  netPay: number;
  currency: string; // e.g., "USD", "EUR"
}

/**
 * Props for the PayslipCard component.
 */
interface PayslipCardProps {
  payslip: Payslip;
}

/**
 * Helper to format a number as currency.
 */
const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Helper to format an ISO date string into a more readable format.
 */
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * A React component that displays payslip details in a visually appealing card format.
 * It breaks down earnings, deductions, and net pay for a specific pay period.
 */
const PayslipCard: React.FC<PayslipCardProps> = ({ payslip }) => {
  const totalDeductions = payslip.deductions.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div style={styles.card}>
      <header style={styles.header}>
        <h2 style={styles.title}>Payslip</h2>
        <div style={styles.companyInfo}>
          <p style={styles.companyName}>{payslip.employerName}</p>
        </div>
      </header>

      <section style={styles.infoSection}>
        <div>
          <p style={styles.infoLabel}>Employee</p>
          <p style={styles.infoValue}>{payslip.employeeName}</p>
        </div>
        <div>
          <p style={styles.infoLabel}>Pay Period</p>
          <p style={styles.infoValue}>
            {formatDate(payslip.payPeriodStart)} – {formatDate(payslip.payPeriodEnd)}
          </p>
        </div>
        <div>
          <p style={styles.infoLabel}>Pay Date</p>
          <p style={styles.infoValue}>{formatDate(payslip.payDate)}</p>
        </div>
      </section>

      <hr style={styles.divider} />

      <main style={styles.detailsGrid}>
        <section>
          <h3 style={styles.sectionTitle}>Earnings</h3>
          <div style={styles.lineItem}>
            <span>Gross Pay</span>
            <span>{formatCurrency(payslip.grossPay, payslip.currency)}</span>
          </div>
        </section>

        <section>
          <h3 style={styles.sectionTitle}>Deductions</h3>
          {payslip.deductions.map((deduction, index) => (
            <div key={index} style={styles.lineItem}>
              <span>{deduction.name}</span>
              <span>- {formatCurrency(deduction.amount, payslip.currency)}</span>
            </div>
          ))}
           <div style={{ ...styles.lineItem, ...styles.totalLineItem }}>
            <strong>Total Deductions</strong>
            <strong>- {formatCurrency(totalDeductions, payslip.currency)}</strong>
          </div>
        </section>
      </main>

      <hr style={styles.divider} />

      <footer style={styles.summarySection}>
        <h3 style={styles.netPayLabel}>Net Pay</h3>
        <p style={styles.netPayValue}>
          {formatCurrency(payslip.netPay, payslip.currency)}
        </p>
      </footer>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  card: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '700px',
    margin: '20px auto',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    backgroundColor: '#ffffff',
    color: '#212529',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 600,
    color: '#003366',
  },
  companyInfo: {
    textAlign: 'right',
  },
  companyName: {
    margin: 0,
    fontWeight: 'bold',
    fontSize: '18px',
  },
  infoSection: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '20px',
  },
  infoLabel: {
    margin: '0 0 4px 0',
    fontSize: '12px',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  infoValue: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 500,
  },
  divider: {
    border: 0,
    borderTop: '1px solid #e9ecef',
    margin: '20px 0',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#003366',
    marginBottom: '12px',
    paddingBottom: '6px',
    borderBottom: '2px solid #e9ecef',
  },
  lineItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: '15px',
  },
  totalLineItem: {
    borderTop: '1px solid #dee2e6',
    marginTop: '8px',
    paddingTop: '10px',
  },
  summarySection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: '16px 20px',
    borderRadius: '6px',
    marginTop: '20px',
  },
  netPayLabel: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#003366',
  },
  netPayValue: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#003366',
  },
};

export default PayslipCard;