import axios from "axios";

// Helper: detect if running locally in browser
const isLocalhost = () => {
  if (typeof window === "undefined") return false; // SSR, default to production
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
};

const baseURL = isLocalhost()
  ? "http://127.0.0.1:8000/api/"
  : "/api/"; // In prod, let rewrites/proxy handle /api/

const API = axios.create({ baseURL });

export default API;
