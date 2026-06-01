import { useEffect, useState } from "react";
import SetupFlow from "../components/SetupFlow";
import { getStatus } from "../api";

export default function Connect() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const status = await getStatus();
        if (active) setConnected(status.mcp === "connected");
      } catch {
        if (active) setConnected(false);
      }
    }
    check();
    const interval = setInterval(check, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return <SetupFlow connected={connected} />;
}
