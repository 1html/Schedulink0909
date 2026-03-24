const express = require("express");
const { google } = require("googleapis");
const { parseScheduleText, TIMEZONE } = require("./scheduleParser");

const router = express.Router();

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthorizedCalendar(tokens) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  return google.calendar({
    version: "v3",
    auth: oauth2Client,
  });
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function addOneHour(timeText) {
  const [hours, minutes] = timeText.split(":").map(Number);
  const date = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
  date.setUTCHours(date.getUTCHours() + 1);

  const nextHours = String(date.getUTCHours()).padStart(2, "0");
  const nextMinutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${nextHours}:${nextMinutes}`;
}

function buildEventRequest(parsed, originalText) {
  if (!parsed.summary) {
    const error = new Error(
      "일정 제목을 해석하지 못했습니다. 문장을 조금 더 구체적으로 입력해주세요."
    );
    error.status = 400;
    error.parsed = parsed;
    throw error;
  }

  if (!parsed.date) {
    const error = new Error(
      "날짜를 해석하지 못했습니다. 날짜를 포함해서 다시 입력해주세요."
    );
    error.status = 400;
    error.parsed = parsed;
    throw error;
  }

  const attendees = (parsed.attendees || [])
    .filter((value) => typeof value === "string" && value.includes("@"))
    .map((email) => ({ email }));

  const requestBody = {
    summary: parsed.summary,
    description: `원본 입력: ${originalText}`,
  };

  if (parsed.location) {
    requestBody.location = parsed.location;
  }

  if (attendees.length > 0) {
    requestBody.attendees = attendees;
  }

  if (parsed.startTime) {
    const endTime = parsed.endTime || addOneHour(parsed.startTime);

    requestBody.start = {
      dateTime: `${parsed.date}T${parsed.startTime}:00`,
      timeZone: TIMEZONE,
    };
    requestBody.end = {
      dateTime: `${parsed.date}T${endTime}:00`,
      timeZone: TIMEZONE,
    };
  } else {
    requestBody.start = {
      date: parsed.date,
      timeZone: TIMEZONE,
    };
    requestBody.end = {
      date: addDays(parsed.date, 1),
      timeZone: TIMEZONE,
    };
  }

  return requestBody;
}

router.get("/google", (req, res) => {
  const oauth2Client = createOAuth2Client();

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });

  res.redirect(url);
});

router.get("/google/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });

    const userInfoResponse = await oauth2.userinfo.get();
    const user = userInfoResponse.data;

    req.session.user = {
      name: user.name,
      email: user.email,
      picture: user.picture,
    };

    req.session.tokens = tokens;

    res.redirect(`${process.env.FRONTEND_URL}`);
  } catch (error) {
    console.error("Google 로그인 오류:", error.message);
    res.status(500).send("로그인 처리 중 오류가 발생했습니다.");
  }
});

router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "로그인되어 있지 않습니다.",
    });
  }

  return res.json({
    success: true,
    user: req.session.user,
  });
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({
      success: true,
      message: "로그아웃되었습니다.",
    });
  });
});

router.get("/events", async (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).json({
      success: false,
      message: "로그인이 필요합니다.",
    });
  }

  try {
    const calendar = getAuthorizedCalendar(req.session.tokens);

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    return res.json(response.data.items || []);
  } catch (error) {
    console.error("캘린더 이벤트 조회 실패:", error);
    return res.status(500).json({
      success: false,
      message: "이벤트를 불러오지 못했습니다.",
    });
  }
});

router.post("/quick-add", async (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).json({
      success: false,
      message: "로그인이 필요합니다.",
    });
  }

  try {
    const text = req.body?.text;
    const { parsed, currentDateTime, timezone } = await parseScheduleText(text);
    const requestBody = buildEventRequest(parsed, text);
    const calendar = getAuthorizedCalendar(req.session.tokens);

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody,
    });

    return res.status(201).json({
      success: true,
      message: "일정이 캘린더에 추가되었습니다.",
      currentDateTime,
      timezone,
      parsed,
      event: response.data,
    });
  } catch (error) {
    console.error("빠른 일정 추가 실패:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "일정 추가 중 오류가 발생했습니다.",
      parsed: error.parsed || null,
    });
  }
});

module.exports = router;
