const express = require("express");
const session = require("express-session");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const authRouter = require("./auth");
const aiRouter = require("./ai");


const app = express();
const PORT = process.env.PORT || 3000;

// JSON 처리
app.use(express.json());

// CORS 설정
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// 세션 설정
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// 기본 테스트
app.get("/", (req, res) => {
  res.send("서버 실행 중");
});

//  여기 추가
app.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "백엔드 정상 작동 중",
  });
});

app.use("/auth", authRouter);
app.use("/ai", aiRouter);

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});