import React, { useState, useMemo } from 'react';
import { DamlLedger, useParty, useLedger, useStreamQueries } from '@c7/react';
import {
  Compensation,
  Payslip,
  PayrollControl
} from '@canton-payroll/daml-types'; // Assuming types are generated here
import { PayslipCard } from './PayslipCard';
import { runPayroll } from './payrollService';

// --- Material-UI Imports ---
import {
  Container,
  AppBar,
  Toolbar,
  Typography,
  Button,
  TextField,
  Grid,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Alert,
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme
} from '@mui/material';

// --- Constants ---
const LEDGER_URL = 'http://localhost:7575';

// --- Theming ---
const theme = createTheme({
  palette: {
    primary: {
      main: '#003366', // A professional blue
    },
    secondary: {
      main: '#4caf50', // A contrasting green for actions
    },
    background: {
      default: '#f4f6f8',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
    },
  },
});

// --- Login Component ---
const LoginScreen: React.FC<{ onLogin: (token: string, party: string) => void }> = ({ onLogin }) => {
  const [token, setToken] = useState('');
  const [party, setParty] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim() && party.trim()) {
      onLogin(token, party);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={6} sx={{ marginTop: 8, padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5">
          Payroll Admin Login
        </Typography>
        <Box component="form" onSubmit={handleLogin} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="party"
            label="Party ID"
            name="party"
            autoComplete="off"
            autoFocus
            value={party}
            onChange={(e) => setParty(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="token"
            label="Ledger API Token (JWT)"
            type="password"
            id="token"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Sign In
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};


// --- Main Dashboard Component ---
const MainDashboard: React.FC = () => {
  const party = useParty();
  const ledger = useLedger();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Ledger Queries ---
  const { contracts: compensations, loading: compensationsLoading } = useStreamQueries(Compensation);
  const { contracts: payslips, loading: payslipsLoading } = useStreamQueries(Payslip);
  const { contracts: payrollControls, loading: payrollControlLoading } = useStreamQueries(PayrollControl);

  // --- Derived State ---
  const payrollControl = payrollControls[0]; // Assuming one control contract per HR manager
  const selectedEmployeeComp = useMemo(() =>
    compensations.find(c => c.payload.employee === selectedEmployeeId),
    [compensations, selectedEmployeeId]);

  const selectedEmployeePayslips = useMemo(() => {
    if (!selectedEmployeeId) return [];
    return payslips
      .filter(p => p.payload.employee === selectedEmployeeId)
      .sort((a, b) => new Date(b.payload.payPeriodEnd).getTime() - new Date(a.payload.payPeriodEnd).getTime());
  }, [payslips, selectedEmployeeId]);


  // --- Event Handlers ---
  const handleRunPayroll = async () => {
    if (!payrollControl) {
      setError("Payroll control contract not found. Cannot run payroll.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await runPayroll(ledger, payrollControl.contractId);
    } catch (err: any) {
      console.error("Payroll run failed:", err);
      setError(err?.message ?? "An unknown error occurred during the payroll run.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
  }

  const isLoadingData = compensationsLoading || payslipsLoading || payrollControlLoading;

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Canton Payroll Dashboard
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            Logged in as: {party}
          </Typography>
          <Button
            color="secondary"
            variant="contained"
            onClick={handleRunPayroll}
            disabled={!payrollControl || isLoading}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Run Next Payroll'}
          </Button>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default' }}
      >
        <Toolbar />
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={3}>
          {/* Employee List Panel */}
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ height: 'calc(100vh - 120px)', overflow: 'auto' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
                <Typography variant="h6">Employees</Typography>
              </Box>
              {isLoadingData ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <List component="nav">
                  {compensations.map(comp => (
                    <ListItemButton
                      key={comp.contractId}
                      selected={selectedEmployeeId === comp.payload.employee}
                      onClick={() => handleSelectEmployee(comp.payload.employee)}
                    >
                      <ListItemText
                        primary={comp.payload.employeeName}
                        secondary={`ID: ${comp.payload.employeeId}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>

          {/* Payslip Details Panel */}
          <Grid item xs={12} md={8}>
            <Paper elevation={3} sx={{ height: 'calc(100vh - 120px)', overflow: 'auto', p: 3 }}>
              {!selectedEmployeeId ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="h6" color="text.secondary">
                    Select an employee to view their payslips
                  </Typography>
                </Box>
              ) : selectedEmployeeComp ? (
                <>
                  <Typography variant="h5" gutterBottom>
                    Payslips for {selectedEmployeeComp.payload.employeeName}
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    Annual Salary: ${parseFloat(selectedEmployeeComp.payload.annualSalary).toLocaleString()}
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    {selectedEmployeePayslips.length > 0 ? (
                      selectedEmployeePayslips.map(payslip => (
                        <Grid item xs={12} sm={6} key={payslip.contractId}>
                          <PayslipCard payslipEvent={payslip} />
                        </Grid>
                      ))
                    ) : (
                      <Grid item xs={12}>
                        <Typography color="text.secondary">No payslips generated for this employee yet.</Typography>
                      </Grid>
                    )}
                  </Grid>
                </>
              ) : (
                 <Typography color="text.secondary">Loading employee details...</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};


// --- App Entry Point ---
const App: React.FC = () => {
  const [credentials, setCredentials] = useState<{ token: string; party: string } | null>(null);

  const handleLogin = (token: string, party: string) => {
    setCredentials({ token, party });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!credentials ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <DamlLedger token={credentials.token} party={credentials.party} httpBaseUrl={LEDGER_URL}>
          <MainDashboard />
        </DamlLedger>
      )}
    </ThemeProvider>
  );
};

export default App;