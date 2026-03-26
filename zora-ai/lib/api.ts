import axios from "axios";

const BASE_URL = "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ─── Auth ───
export const authMe = () => api.get("/auth/me");
export const authLogin = (email: string, password: string) =>
  api.post("/auth/login", { email, password });
export const authSignup = (data: {
  email: string;
  password: string;
  full_name?: string;
  role?: string;
  organization_name?: string;
}) => api.post("/auth/signup", data);
export const authLogout = () => api.post("/auth/logout");

// ─── SMS ───
export const analyzeSMS = (text: string) =>
  api.post("/text/sms/analyze", { text, include_llm_explanation: true });

// ─── Email ───
export const analyzeEmail = (sender: string, subject: string, body: string) =>
  api.post("/text/email/analyze", {
    sender,
    subject,
    body,
    with_llm_explanation: true,
  });

// ─── URL ───
export const analyzeURL = (url: string) =>
  api.post("/url/analyze", { url, with_llm_explanation: true });

// ─── Attachment ───
export const analyzeAttachment = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  form.append("with_llm_explanation", "true");
  return api.post("/attachment/analyze", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ─── Voice ───
export const analyzeVoice = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/voice/analyse", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ─── History ───
export const getSMSHistory = () => api.get("/text/sms/history");
export const getEmailHistory = () => api.get("/text/email/history");
export const getURLHistory = () => api.get("/url/history");
export const getAttachmentHistory = () => api.get("/attachment/history");
export const getVoiceHistory = () => api.get("/voice/history");

export const getSMSDetail = (id: string) =>
  api.get(`/text/sms/history/${id}`);
export const getEmailDetail = (id: string) =>
  api.get(`/text/email/history/${id}`);
export const getURLDetail = (id: string) => api.get(`/url/history/${id}`);
export const getAttachmentDetail = (id: string) =>
  api.get(`/attachment/history/${id}`);
export const getVoiceDetail = (id: string) =>
  api.get(`/voice/history/${id}`);

export default api;
