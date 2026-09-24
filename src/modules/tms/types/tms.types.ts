export type TerminalModel = 'sunmi' | 'telpo' | 'pax';

export interface TerminalHeartbeatInput {
  terminalId: string;
  model: TerminalModel;
  batteryLevel?: number;
  signalStrength?: number;
}

export interface TerminalTransactionInput {
  terminalId: string;
  agentId: string;
  amount: number;
  cardMaskedPan: string; // e.g. "506099******1234" — never store/log the full PAN
  reference: string;
}

export interface TerminalTransactionResult {
  reference: string;
  status: 'success' | 'failed' | 'dispense_error';
  providerReference?: string;
}