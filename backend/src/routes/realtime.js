const express = require("express");
const { authRequired } = require("../middleware/authRequired");
const { addClient } = require("../realtime");

const router = express.Router();
router.get("/", authRequired, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const remove = addClient(res, req.user);
  req.on("close", remove);
});

module.exports = router;
