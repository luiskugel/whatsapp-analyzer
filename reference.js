const messageRegex =
  /^\[(\d{2}\.\d{2}\.\d{2}),\s(\d{2}:\d{2}:\d{2})\]\s([^:]+):\s([\s\S]*?)(?=\[\d{2}\.\d{2}\.\d{2},\s\d{2}:\d{2}:\d{2}\]|$)/;

function cleanMessage(message) {
  return message;
}

function getWeekOfYear(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function parseWhatsAppChatText(chatContent) {
  const messageBlocks = chatContent.split(
    /(?=\[\d{2}\.\d{2}\.\d{2},\s\d{2}:\d{2}:\d{2}\])/
  );
  const messages = [];
  messageBlocks.forEach((block) => {
    const match = block.match(messageRegex);
    if (match) {
      const [_, date, time, sender, message] = match;
      messages.push({
        date,
        time,
        sender: sender.trim(),
        message: cleanMessage(message),
      });
    }
  });
  return messages.map((message) => {
    const msg = message.message.trim();
    if (msg.includes("<attached:")) {
      const filename = msg.replace(/<attached:/, "").replace(">", "");
      let extension = filename
        .split(".")
        .pop()
        .toLowerCase()
        .replaceAll("\n", "")
        .replaceAll("\r", "")
        .trim();
      switch (extension) {
        case "jpg":
        case "jpeg":
        case "png":
          message.type = "image";
          break;
        case "opus":
          message.type = "voice-message";
          break;
        case "pdf":
          message.type = "file";
          break;
        default:
          message.type = "attachment";
      }
    } else if (msg.toLowerCase().includes("voice call")) {
      message.type = "call";
    } else {
      message.type = "text";
    }
    const [day, month, yearShort] = message.date.split(".").map(Number);
    const fullYear = 2000 + yearShort;
    const dateObj = new Date(fullYear, month - 1, day);
    message.year = fullYear;
    message.month = dateObj.getMonth() + 1;
    message.week = getWeekOfYear(dateObj);

    return message;
  });
}

window.parseWhatsAppChatText = parseWhatsAppChatText;
