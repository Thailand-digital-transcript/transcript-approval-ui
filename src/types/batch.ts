export type BatchStatus =
  | 'DRAFT' | 'PENDING_REGISTRAR' | 'REGISTRAR_SIGNING' | 'PENDING_DEAN'
  | 'DEAN_SIGNING' | 'SEALING' | 'PDF_GENERATION' | 'PDF_SIGNING'
  | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export type ItemStatus = 'PENDING' | 'ASSIGNED' | 'SIGNED' | 'REJECTED' | 'FAILED' | string;

export interface TranscriptItemSummary {
  id: string; transcriptId: string; documentId: string; institutionCode: string;
  transcriptType: string; status: ItemStatus; batchId: string;
}
export interface BatchSummary {
  id: string; name: string; institutionCode: string; status: BatchStatus;
  itemCount: number; createdBy: string; createdAt: string;
}
export interface BatchDetail extends BatchSummary {
  completedAt?: string; registrarApprovedBy?: string; registrarApprovedAt?: string;
  deanApprovedBy?: string; deanApprovedAt?: string; rejectionReason?: string;
  failureReason?: string; items: TranscriptItemSummary[];
}
export type Decision = 'APPROVE' | 'REJECT';
export interface DecisionResult { batchId: string; decisionId: string; status: BatchStatus; accepted: boolean; }
