import { AiExecutionRequest, AiExecutionResponse, CoachingResponse, OpenStructureResponse } from '../models/ai.models';

export interface AiProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  analyzeExecution(symbol: string, signalType: string): Promise<AiExecutionResponse>;
  analyzeOpenStructure(symbol: string): Promise<OpenStructureResponse>;
  generateCoaching(symbol: string): Promise<CoachingResponse>;
}

export type { AiExecutionRequest };
