import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

// Types matching the API response
interface UploadResponse {
  jobId: string;
  status: 'queued';
  message: string;
}

interface JobStatus {
  id: string;
  status: 'queued' | 'parsing' | 'PENDING_APPROVAL' | 'processing' | 'completed' | 'failed';
  totalLines: number;
  parsedCount: number;
  invalidCount: number;
  chunks: number;
  createdAt: string;
  error?: string;
  parserSummary?: {
     valid: number;
     invalid: number;
     preview: any[];
  }
}

export function useAsyncBatchPayment() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // 1. Upload File
  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setJobId(null);
    setJobStatus(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/batch/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data: UploadResponse = await response.json();
      setJobId(data.jobId);
      toast({
        title: "File Uploaded",
        description: "Your file is being processed in the background.",
      });
      
      // Start polling immediately
      startPolling(data.jobId);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  // 2. Poll Status
  const checkStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/batch/status?id=${id}`);
      if (response.ok) {
        const data: JobStatus = await response.json();
        setJobStatus(data);
        
        // Stop polling if terminal state or waiting for action
        if (data.status === 'PENDING_APPROVAL' || data.status === 'completed' || data.status === 'failed') {
            stopPolling();
             if (data.status === 'PENDING_APPROVAL') {
                toast({ title: "Analysis Complete", description: "Please review and approve execution." });
            }
        }
      }
    } catch (error) {
       console.error("Polling error", error);
    }
  }, [toast]);

  const startPolling = (id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsPolling(true);
    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(() => checkStatus(id), 2000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  // 3. Approve Execution
  const executeBatch = useCallback(async () => {
    if (!jobId) return;

    try {
      const response = await fetch('/api/batch/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) throw new Error("Failed to start execution");

      toast({
        title: "Execution Started",
        description: "The batch has been queued for processing.",
      });
      
      // Resume polling to track processing progress
      startPolling(jobId);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Execution Error",
        description: error.message
      });
    }
  }, [jobId, toast]);

  return {
    uploadFile,
    executeBatch,
    jobId,
    jobStatus,
    isUploading,
    isPolling
  };
}
