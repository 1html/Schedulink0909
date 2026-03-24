const express = require("express");
const { parseScheduleText } = require("./scheduleParser");

const router = express.Router();

router.get("/test", (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      success: false,
      message: "OPENAI_API_KEY가 설정되지 않았습니다.",
    });
  }

  return res.json({
    success: true,
    message: "OpenAI API 연결이 가능합니다.",
  });
});

router.post("/parse", async (req, res) => {
  try {
    const result = await parseScheduleText(req.body?.text);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("AI 파싱 오류:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "자연어 파싱 중 오류가 발생했습니다.",
      parsed: error.parsed || null,
    });
  }
});

module.exports = router;
