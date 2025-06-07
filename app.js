if (typeof Chart !== "undefined" && Chart.defaults) {
  Chart.defaults.devicePixelRatio = 1;
  Chart.defaults.responsive = false;
  Chart.defaults.maintainAspectRatio = false;
}

let currentViewMode = "month";
let charts = [];
window.selectedEmojis = [];

function clearCharts() {
  charts.forEach((chart) => chart.destroy());
  charts = [];
  const container = document.getElementById("charts");
  container.innerHTML = `
    <canvas id="messages-chart"></canvas>
    <canvas id="words-chart"></canvas>
    <canvas id="emojis-chart"></canvas>
    <canvas id="voice-messages-chart"></canvas>
    <canvas id="images-chart"></canvas>
    <canvas id="files-chart"></canvas>
    <canvas id="emoji-uses-chart"></canvas>
    <canvas id="emoji-messages-chart"></canvas>
  `;
}

function getColor(index, total, alpha = 0.7) {
  const hue = Math.round((index * 360) / total);
  return `hsla(${hue},65%,50%,${alpha})`;
}

function countWords(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function countEmojis(text) {
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countSelectedEmojis(text) {
  let count = 0;
  if (!window.selectedEmojis || window.selectedEmojis.length === 0) {
    return 0;
  }
  window.selectedEmojis.forEach((emoji) => {
    const regex = new RegExp(escapeRegExp(emoji), "g");
    const matches = text.match(regex);
    if (matches) count += matches.length;
  });
  return count;
}

function populateEmojiSelector(messages) {
  const emojiSet = new Set();
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  messages.forEach((m) => {
    const matches = m.message.match(emojiRegex);
    if (matches) {
      matches.forEach((e) => emojiSet.add(e));
    }
  });
  const optionsContainer = document.getElementById("emoji-options");
  optionsContainer.innerHTML = "";
  Array.from(emojiSet)
    .sort()
    .forEach((emoji) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = emoji;
      checkbox.addEventListener("change", () => {
        window.selectedEmojis = Array.from(
          document.querySelectorAll("#emoji-options input:checked")
        ).map((i) => i.value);
        renderCharts(window.messages || []);
      });
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(emoji));
      optionsContainer.appendChild(label);
    });
}

function renderCharts(messages) {
  clearCharts();
  if (!messages || messages.length === 0) {
    return;
  }
  const participants = Array.from(new Set(messages.map((m) => m.sender)));

  const showSelected =
    window.selectedEmojis && window.selectedEmojis.length > 0;
  const usesCanvas = document.getElementById("emoji-uses-chart");
  const msgsCanvas = document.getElementById("emoji-messages-chart");
  if (usesCanvas && msgsCanvas) {
    usesCanvas.style.display = showSelected ? "" : "none";
    msgsCanvas.style.display = showSelected ? "" : "none";
  }

  const weekPeriods = Array.from(
    new Set(
      messages.map((m) => `${m.year}-W${String(m.week).padStart(2, "0")}`)
    )
  ).sort();
  const monthPeriods = Array.from(
    new Set(
      messages.map((m) => `${m.year}-${String(m.month).padStart(2, "0")}`)
    )
  ).sort();
  const periods = currentViewMode === "week" ? weekPeriods : monthPeriods;

  const metricTypes = [
    "messages",
    "words",
    "emojis",
    "voice-messages",
    "images",
    "files",
  ];
  if (showSelected) {
    metricTypes.push("emoji-uses", "emoji-messages");
  }
  const metricsData = {};
  metricTypes.forEach((type) => {
    metricsData[type] = {
      perParticipant: {},
      overall: Array(periods.length).fill(0),
    };
    participants.forEach((p) => {
      metricsData[type].perParticipant[p] = Array(periods.length).fill(0);
    });
  });

  messages.forEach((m) => {
    const periodKey =
      currentViewMode === "week"
        ? `${m.year}-W${String(m.week).padStart(2, "0")}`
        : `${m.year}-${String(m.month).padStart(2, "0")}`;
    const idx = periods.indexOf(periodKey);
    if (idx < 0) return;

    const selectedCount = showSelected ? countSelectedEmojis(m.message) : 0;
    metricTypes.forEach((type) => {
      let value = 0;
      if (type === "messages") {
        value = 1;
      } else if (type === "words") {
        value = countWords(m.message);
      } else if (type === "emojis") {
        value = countEmojis(m.message);
      } else if (type === "voice-messages") {
        value = m.type === "voice-message" ? 1 : 0;
      } else if (type === "images") {
        value = m.type === "image" ? 1 : 0;
      } else if (type === "files") {
        value = m.type === "file" || m.type === "attachment" ? 1 : 0;
      } else if (type === "emoji-uses") {
        value = selectedCount;
      } else if (type === "emoji-messages") {
        value = selectedCount > 0 ? 1 : 0;
      }
      metricsData[type].perParticipant[m.sender][idx] += value;
      metricsData[type].overall[idx] += value;
    });
  });

  const metricLabels = {
    messages: "Messages",
    words: "Words",
    emojis: "Emojis",
    "voice-messages": "Voice messages",
    images: "Images",
    files: "Other files",
    "emoji-uses": "Selected emojis",
    "emoji-messages": "Messages with selected emojis",
  };

  metricTypes.forEach((type) => {
    const canvas = document.getElementById(`${type}-chart`);
    const rect = canvas.getBoundingClientRect();
    const dpr = 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const datasets = participants.map((p, idx) => ({
      type: "bar",
      label: p,
      data: metricsData[type].perParticipant[p],
      backgroundColor: getColor(idx, participants.length, 0.6),
      borderColor: getColor(idx, participants.length, 1),
      borderWidth: 1,
    }));
    datasets.push({
      type: "line",
      label: "All",
      data: metricsData[type].overall,
      backgroundColor: "rgba(0,0,0,0)",
      borderColor: "#000",
      borderWidth: 2,
      fill: false,
    });

    const chart = new Chart(ctx, {
      data: {
        labels: periods,
        datasets,
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${metricLabels[type]} per ${currentViewMode}`,
          },
        },
        scales: {
          x: { stacked: false },
          y: { beginAtZero: true },
        },
      },
    });
    charts.push(chart);
  });
}

document
  .getElementById("fileInput")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) {
      alert("Please upload a .txt file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      const messages = parseWhatsAppChatText(e.target.result);
      window.messages = messages;
      console.log("Parsed messages:", messages);
      populateEmojiSelector(messages);
      window.selectedEmojis = [];
      renderCharts(messages);
    };
    reader.onerror = function (e) {
      console.error("Error reading file", e);
    };
    reader.readAsText(file);
  });

document.querySelectorAll(".view-toggle button").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".view-toggle button")
      .forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    currentViewMode = button.getAttribute("data-view");
    renderCharts(window.messages || []);
  });
});

const instrButton = document.getElementById("show-instructions");
if (instrButton) {
  instrButton.addEventListener("click", () => {
    const inst = document.getElementById("export-instructions");
    inst.classList.toggle("visible");
  });
}
