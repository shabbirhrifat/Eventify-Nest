export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
  error: string;
  message: string | string[];
}
