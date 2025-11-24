import cors from "cors";

app.use(cors({
  origin: "http://localhost:8080",   // FE của bạn
  credentials: true,                 // nếu dùng cookie
}));