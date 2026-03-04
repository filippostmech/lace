import { useState, useEffect, useRef, useCallback } from "react";
import { JobExecutor, ConnectionStatus, JobSummary } from "@/lib/job-executor";

const HOST_URL_KEY = "lace-host-url";
const DEFAULT_HOST_URL = "ws://127.0.0.1:8080/ws";

export function useJobExecutor() {
  const executorRef = useRef<JobExecutor | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [recentJobs, setRecentJobs] = useState<JobSummary[]>([]);

  useEffect(() => {
    const executor = new JobExecutor();
    executorRef.current = executor;

    const unsubStatus = executor.onStatusChange(setConnectionStatus);
    const unsubJobs = executor.onJobsChange(setRecentJobs);

    const savedUrl = localStorage.getItem(HOST_URL_KEY);
    if (savedUrl) {
      executor.connect(savedUrl);
    }

    return () => {
      unsubStatus();
      unsubJobs();
      executor.destroy();
    };
  }, []);

  const connect = useCallback((url: string) => {
    localStorage.setItem(HOST_URL_KEY, url);
    executorRef.current?.connect(url);
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(HOST_URL_KEY);
    executorRef.current?.disconnect();
  }, []);

  const getHostUrl = useCallback(() => {
    return executorRef.current?.hostUrl || localStorage.getItem(HOST_URL_KEY) || DEFAULT_HOST_URL;
  }, []);

  const activeJobCount = recentJobs.filter(
    (j) => j.status === "queued" || j.status === "running"
  ).length;

  return {
    connectionStatus,
    recentJobs,
    activeJobCount,
    connect,
    disconnect,
    getHostUrl,
  };
}
