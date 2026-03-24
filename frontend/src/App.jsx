import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function normalizeEvent(event) {
  return {
    id: event.id,
    title: event.summary,
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
  };
}

function sortEvents(eventList) {
  return [...eventList].sort((a, b) => {
    const first = new Date(a.start).getTime();
    const second = new Date(b.start).getTime();
    return first - second;
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lastParsed, setLastParsed] = useState(null);

  async function loadEvents() {
    const response = await fetch(`${API_BASE_URL}/auth/events`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("캘린더 이벤트를 불러오지 못했습니다.");
    }

    const data = await response.json();
    setEvents(sortEvents(data.map(normalizeEvent)));
  }

  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error();
        }

        return res.json();
      })
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoadingUser(false);
      });
  }, []);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    loadEvents().catch((error) => {
      setErrorMessage(error.message);
    });
  }, [user]);

  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      credentials: "include",
    });

    setUser(null);
    setEvents([]);
    setTextInput("");
    setErrorMessage("");
    setSuccessMessage("");
    setLastParsed(null);
  };

  const handleQuickAdd = async (event) => {
    event.preventDefault();

    if (!textInput.trim()) {
      setErrorMessage("일정 문장을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/quick-add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ text: textInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "일정 추가에 실패했습니다.");
      }

      setSuccessMessage(data.message || "일정이 추가되었습니다.");
      setLastParsed(data.parsed || null);
      setTextInput("");

      if (data.event) {
        const createdEvent = normalizeEvent(data.event);

        setEvents((currentEvents) => {
          const filteredEvents = currentEvents.filter(
            (item) => item.id !== createdEvent.id
          );

          return sortEvents([...filteredEvents, createdEvent]);
        });
      } else {
        await loadEvents();
      }
    } catch (error) {
      setErrorMessage(error.message || "일정 추가 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return <div style={{ padding: "20px" }}>로그인 상태를 확인하는 중입니다.</div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1>Schedulink</h1>

      {!user ? (
        <div>
          <p>Google 로그인 후 자연어로 일정을 추가할 수 있습니다.</p>
          <button onClick={handleLogin}>Google 로그인</button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {user.picture ? (
                <img
                  src={user.picture}
                  alt="프로필 이미지"
                  width="56"
                  height="56"
                  style={{ borderRadius: "50%" }}
                />
              ) : null}
              <div>
                <strong>{user.name}</strong>
                <div>{user.email}</div>
              </div>
            </div>
            <button onClick={handleLogout}>로그아웃</button>
          </div>

          <form
            onSubmit={handleQuickAdd}
            style={{
              display: "grid",
              gap: "12px",
              padding: "16px",
              border: "1px solid #d9d9d9",
              borderRadius: "12px",
              backgroundColor: "#fafafa",
            }}
          >
            <label htmlFor="schedule-input">자연어로 일정 추가</label>
            <input
              id="schedule-input"
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="예: 내일 오후 2시에 팀 회의, 강남 오피스"
              style={{ padding: "12px" }}
            />
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button type="submit" disabled={submitting}>
                {submitting ? "추가 중..." : "일정 추가"}
              </button>
              <span style={{ color: "#666" }}>
                시간이 없으면 종일 일정으로, 종료 시간이 없으면 1시간 일정으로 저장됩니다.
              </span>
            </div>
            {errorMessage ? (
              <div style={{ color: "#b42318" }}>{errorMessage}</div>
            ) : null}
            {successMessage ? (
              <div style={{ color: "#027a48" }}>{successMessage}</div>
            ) : null}
            {lastParsed ? (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  backgroundColor: "#fff",
                  border: "1px solid #e4e7ec",
                }}
              >
                <div>제목: {lastParsed.summary || "-"}</div>
                <div>날짜: {lastParsed.date || "-"}</div>
                <div>
                  시간: {lastParsed.startTime || "종일"} ~{" "}
                  {lastParsed.endTime ||
                    (lastParsed.startTime ? "자동 +1시간" : "종일")}
                </div>
                <div>장소: {lastParsed.location || "-"}</div>
              </div>
            ) : null}
          </form>

          <div>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin]}
              initialView="dayGridMonth"
              events={events}
              height="auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
