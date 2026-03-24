const OpenAI = require("openai");

const TIMEZONE = "Asia/Seoul";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getCurrentDateTimeInSeoul() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+09:00`;
}

function isValidDate(dateStr) {
  if (dateStr === null) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidTime(timeStr) {
  if (timeStr === null) {
    return true;
  }

  return /^\d{2}:\d{2}$/.test(timeStr);
}

function createHttpError(status, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function validateParsedSchedule(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw createHttpError(502, "OpenAI가 일정 JSON을 올바르게 반환하지 않았습니다.");
  }

  if (!isValidDate(parsed.date)) {
    throw createHttpError(400, "AI가 잘못된 날짜 형식을 반환했습니다.", {
      parsed,
    });
  }

  if (!isValidTime(parsed.startTime) || !isValidTime(parsed.endTime)) {
    throw createHttpError(400, "AI가 잘못된 시간 형식을 반환했습니다.", {
      parsed,
    });
  }
}

async function parseScheduleText(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw createHttpError(500, "OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  if (!text || !text.trim()) {
    throw createHttpError(400, "일정 문장을 입력해주세요.");
  }

  const currentDateTime = getCurrentDateTimeInSeoul();

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
너는 일정 문장을 JSON으로 파싱하는 일정 비서다.
설명, 추가 문장, 마크다운 없이 반드시 JSON만 반환해라.

기준 규칙:
1. 현재 기준 시각은 ${currentDateTime} 이다.
2. 시간대는 ${TIMEZONE} 이다.
3. "오늘", "내일", "모레", "이번 주 금요일" 같은 상대 날짜 표현은 반드시 기준 시각과 시간대로 해석해라.
4. date는 반드시 YYYY-MM-DD 형식으로 반환해라.
5. startTime, endTime은 반드시 HH:MM 형식으로 반환해라.
6. 일정 제목은 summary에 넣어라.
7. 장소가 없으면 location은 null.
8. 참석자가 없으면 attendees는 [].
9. 종료 시간이 없으면 endTime은 null.
10. 날짜를 전혀 판단할 수 없으면 date는 null.
11. 시작 시간을 전혀 판단할 수 없으면 startTime은 null.
12. 과도한 추측이 필요하면 null을 사용해라.
        `.trim(),
      },
      {
        role: "user",
        content: text,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "schedule_parser",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: ["string", "null"] },
            date: { type: ["string", "null"] },
            startTime: { type: ["string", "null"] },
            endTime: { type: ["string", "null"] },
            location: { type: ["string", "null"] },
            attendees: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: [
            "summary",
            "date",
            "startTime",
            "endTime",
            "location",
            "attendees",
          ],
        },
      },
    },
  });

  const parsedText = completion.choices?.[0]?.message?.content;

  if (!parsedText) {
    throw createHttpError(502, "OpenAI 응답에서 파싱 결과를 받지 못했습니다.");
  }

  let parsed;

  try {
    parsed = JSON.parse(parsedText);
  } catch (error) {
    throw createHttpError(502, "OpenAI 응답이 JSON 형식이 아닙니다.", {
      cause: error,
      raw: parsedText,
    });
  }

  validateParsedSchedule(parsed);

  return {
    currentDateTime,
    timezone: TIMEZONE,
    parsed,
  };
}

module.exports = {
  TIMEZONE,
  parseScheduleText,
};
