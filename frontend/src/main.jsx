import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { GoogleOAuthProvider } from "@react-oauth/google";

ReactDOM.createRoot(document.getElementById("root")).render(
  <GoogleOAuthProvider clientId="673617794125-2c6n1er3t56n9urc7phhh8oe5u7l1m85.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>
);
