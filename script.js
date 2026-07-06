const SITE_DATA_URL = "./sites.json";
const JOIN_EMAIL = "js5185204@gmail.com";
const STRIP_PROTOCOL_PATTERN = /^https:\/\//;

const windows = [...document.querySelectorAll("[data-window]")];
const siteListPanel = document.getElementById("site-list-panel");
const joinForm = document.getElementById("join-form");
const joinUrlInput = document.getElementById("join-url");
const openRingExamplesButton = document.getElementById("open-ring-examples");
const ringWindow = document.querySelector(".window-ring");
const orbitOverlay = document.getElementById("orbit-overlay");
const orbitCircle = document.getElementById("orbit-circle");
const meshCanvas = document.getElementById("mesh-canvas");
const meshContext = meshCanvas.getContext("2d");

let highestZIndex = windows.length;
let dragState = null;
let meshNodes = [];
let meshLinks = [];
let meshPackets = [];
let meshAnimationFrame = null;

initializeWindows();
loadSites();
updateOrbit();
initializeMesh();

joinForm.addEventListener("submit", handleJoinSubmit);
openRingExamplesButton.addEventListener("click", focusRingWindow);

function initializeWindows() {
  windows.forEach((windowElement, index) => {
    const initialZIndexMap = [2, 3, 1];
    windowElement.style.zIndex = String(
      initialZIndexMap[index] ?? windows.length - index
    );
    windowElement.addEventListener("pointerdown", () => bringToFront(windowElement));

    const dragHandle = windowElement.querySelector("[data-drag-handle]");
    if (dragHandle) {
      dragHandle.addEventListener("pointerdown", (event) => {
        startDrag(event, windowElement, dragHandle);
      });
    }
  });

  window.addEventListener("pointermove", handleDragMove);
  window.addEventListener("pointerup", stopDrag);
  window.addEventListener("pointercancel", stopDrag);
  window.addEventListener("resize", handleViewportChange);
}

function bringToFront(windowElement) {
  highestZIndex += 1;
  windowElement.style.zIndex = String(highestZIndex);
}

function startDrag(event, windowElement, dragHandle) {
  if (window.innerWidth <= 920) {
    return;
  }

  if (event.target.closest("button, a, input")) {
    return;
  }

  const rect = windowElement.getBoundingClientRect();

  dragState = {
    pointerId: event.pointerId,
    windowElement,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };

  windowElement.classList.add("dragging");
  bringToFront(windowElement);
  dragHandle.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function handleDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  const { windowElement, offsetX, offsetY } = dragState;
  const maxLeft = Math.max(0, window.innerWidth - windowElement.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - windowElement.offsetHeight);
  const nextLeft = clamp(event.clientX - offsetX, 0, maxLeft);
  const nextTop = clamp(event.clientY - offsetY, 0, maxTop);

  windowElement.style.left = `${nextLeft}px`;
  windowElement.style.top = `${nextTop}px`;
  windowElement.style.right = "auto";
  windowElement.style.bottom = "auto";
  windowElement.style.transform = "none";
  updateOrbit();
}

function stopDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  dragState.windowElement.classList.remove("dragging");
  dragState = null;
  updateOrbit();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function loadSites() {
  try {
    const response = await fetch(SITE_DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const siteData = await response.json();
    renderSiteList(siteData);
    handleWebringNavigation(siteData);
  } catch (error) {
    console.error(error);
    siteListPanel.innerHTML =
      '<p class="status-line">사이트 목록을 불러오지 못했습니다. `sites.json`을 확인해주세요.</p>';
  }
}

function renderSiteList(siteData) {
  if (!Array.isArray(siteData) || siteData.length === 0) {
    siteListPanel.innerHTML =
      '<p class="status-line">등록된 사이트가 아직 없습니다.</p>';
    return;
  }

  const row = document.createElement("div");
  row.className = "site-row";

  siteData.forEach((site) => {
    const normalizedUrl = normalizeSiteUrl(site.url);
    const link = document.createElement("a");
    link.className = "site-link";
    link.href = normalizedUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = normalizedUrl.replace(STRIP_PROTOCOL_PATTERN, "");
    link.title = normalizedUrl;
    row.appendChild(link);
  });

  siteListPanel.replaceChildren(row);
}

function handleWebringNavigation(siteData) {
  if (!Array.isArray(siteData) || siteData.length === 0) {
    return;
  }

  const query = new URLSearchParams(window.location.search);
  const currentSite = getCurrentSite(siteData, query.get("site"));
  const targets = getRingTargets(siteData, currentSite.slug);

  const action = query.get("go");
  if (!action) {
    return;
  }

  const redirectMap = {
    prev: normalizeSiteUrl(targets.previous.url),
    next: normalizeSiteUrl(targets.next.url),
    random: normalizeSiteUrl(targets.random.url),
    home: getBaseUrl(),
  };

  const targetUrl = redirectMap[action];
  if (targetUrl) {
    window.location.replace(targetUrl);
  }
}

function getCurrentSite(siteData, slug) {
  return siteData.find((site) => site.slug === slug) ?? siteData[0];
}

function getRingTargets(siteData, slug) {
  const currentIndex = siteData.findIndex((site) => site.slug === slug);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const current = siteData[safeIndex];
  const previous = siteData[(safeIndex - 1 + siteData.length) % siteData.length];
  const next = siteData[(safeIndex + 1) % siteData.length];

  let random = current;
  if (siteData.length > 1) {
    while (random.slug === current.slug) {
      random = siteData[Math.floor(Math.random() * siteData.length)];
    }
  }

  return { previous, next, random };
}

function getBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function normalizeSiteUrl(url) {
  if (typeof url !== "string") {
    return "";
  }

  if (url.startsWith("https:/") && !url.startsWith("https://")) {
    return url.replace("https:/", "https://");
  }

  if (url.startsWith("http:/") && !url.startsWith("http://")) {
    return url.replace("http:/", "http://");
  }

  if (/^https?:\/\//.test(url)) {
    return url;
  }

  return `https://${url.replace(/^\/+/, "")}`;
}

function handleJoinSubmit(event) {
  event.preventDefault();

  const submittedUrl = joinUrlInput.value.trim();
  if (!submittedUrl) {
    return;
  }

  const subject = encodeURIComponent("독립웹연맹 참여 신청");
  const body = encodeURIComponent(
    [
      "안녕하세요, 독립웹연맹 참여를 신청합니다.",
      "",
      `웹사이트 URL: ${submittedUrl}`,
    ].join("\n")
  );

  window.location.href = `mailto:${JOIN_EMAIL}?subject=${subject}&body=${body}`;
}

function focusRingWindow() {
  if (!ringWindow) {
    return;
  }

  if (window.innerWidth <= 920) {
    ringWindow.scrollIntoView({ behavior: "smooth", block: "end" });
    return;
  }

  bringToFront(ringWindow);
  ringWindow.classList.remove("pulse");
  void ringWindow.offsetWidth;
  ringWindow.classList.add("pulse");
}

function handleViewportChange() {
  updateOrbit();
  initializeMesh();
}

function initializeMesh() {
  if (!meshCanvas || !meshContext) {
    return;
  }

  if (window.innerWidth <= 920) {
    if (meshAnimationFrame) {
      cancelAnimationFrame(meshAnimationFrame);
      meshAnimationFrame = null;
    }
    return;
  }

  const desktop = document.querySelector(".desktop");
  const desktopRect = desktop.getBoundingClientRect();
  const width = Math.max(1, Math.floor(desktopRect.width));
  const height = Math.max(1, Math.floor(desktopRect.height));
  const ratio = window.devicePixelRatio || 1;

  meshCanvas.width = Math.floor(width * ratio);
  meshCanvas.height = Math.floor(height * ratio);
  meshContext.setTransform(1, 0, 0, 1, 0, 0);
  meshContext.scale(ratio, ratio);

  buildMesh(width, height);

  if (!meshAnimationFrame) {
    animateMesh();
  }
}

function buildMesh(width, height) {
  const overflow = Math.max(width, height) * 0.18;
  const nodeCount = 30;
  const hubCount = 6;

  meshNodes = [];
  meshLinks = [];
  meshPackets = [];

  const hubs = Array.from({ length: hubCount }, (_, index) => ({
    x: randomBetween(-overflow, width + overflow),
    y: randomBetween(-overflow, height + overflow),
    spread: randomBetween(330, 630),
    weight: 3 + (index % 3),
  }));

  hubs.forEach((hub) => {
    meshNodes.push({
      x: hub.x,
      y: hub.y,
      radius: randomBetween(2.6, 3.6),
    });
  });

  while (meshNodes.length < nodeCount) {
    const hub = hubs[Math.floor(Math.random() * hubs.length)];
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * hub.spread;

    meshNodes.push({
      x: hub.x + Math.cos(angle) * distance,
      y: hub.y + Math.sin(angle) * distance,
      radius: randomBetween(1.8, 3),
    });
  }

  meshNodes.forEach((node, index) => {
    const nearest = getNearestNodeIndexes(index, 3);
    nearest.forEach((nearestIndex) => addMeshLink(index, nearestIndex));

    if (index < hubs.length) {
      const farConnection = getNearestNodeIndexes(index, 6)[4];
      addMeshLink(index, farConnection);
    }
  });

  const packetCount = Math.min(18, meshLinks.length);
  for (let index = 0; index < packetCount; index += 1) {
    meshPackets.push({
      linkIndex: index % meshLinks.length,
      progress: (index * 0.17) % 1,
      speed: (0.0018 + (index % 5) * 0.00045) * 2,
      direction: index % 2 === 0 ? 1 : -1,
      pauseUntil: 0,
    });
  }
}

function addMeshLink(fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0) {
    return;
  }

  if (fromIndex === toIndex) {
    return;
  }

  const normalizedFrom = Math.min(fromIndex, toIndex);
  const normalizedTo = Math.max(fromIndex, toIndex);
  const duplicate = meshLinks.some(
    (link) => link.fromIndex === normalizedFrom && link.toIndex === normalizedTo
  );

  if (duplicate) {
    return;
  }

  meshLinks.push({ fromIndex: normalizedFrom, toIndex: normalizedTo });
}

function getNearestNodeIndexes(sourceIndex, count) {
  const sourceNode = meshNodes[sourceIndex];

  return meshNodes
    .map((node, index) => ({
      index,
      distance: index === sourceIndex
        ? Number.POSITIVE_INFINITY
        : Math.hypot(node.x - sourceNode.x, node.y - sourceNode.y),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, count)
    .map((item) => item.index);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function animateMesh() {
  if (!meshCanvas || !meshContext) {
    return;
  }

  meshAnimationFrame = requestAnimationFrame(animateMesh);

  if (window.innerWidth <= 920) {
    return;
  }

  const width = meshCanvas.clientWidth;
  const height = meshCanvas.clientHeight;
  const now = performance.now();

  meshContext.clearRect(0, 0, width, height);
  meshContext.lineWidth = 1;
  meshContext.strokeStyle = "rgba(59, 59, 59, 0)";
  meshContext.setLineDash([5, 7]);

  meshLinks.forEach((link) => {
    const fromNode = meshNodes[link.fromIndex];
    const toNode = meshNodes[link.toIndex];
    meshContext.beginPath();
    meshContext.moveTo(fromNode.x, fromNode.y);
    meshContext.lineTo(toNode.x, toNode.y);
    meshContext.stroke();
  });

  meshContext.setLineDash([]);

  meshNodes.forEach((node) => {
    meshContext.beginPath();
    meshContext.fillStyle = "rgba(0, 0, 255, 0)";
    meshContext.strokeStyle = "rgba(59, 59, 59, 0)";
    meshContext.lineWidth = 0.5;
    meshContext.arc(node.x, node.y, node.radius ?? 2.2, 0, Math.PI * 2);
    meshContext.fill();
    meshContext.stroke();
  });

  meshPackets.forEach((packet) => {
    const link = meshLinks[packet.linkIndex];
    const fromNode = meshNodes[link.fromIndex];
    const toNode = meshNodes[link.toIndex];

    if (now >= packet.pauseUntil) {
      packet.progress += packet.speed * packet.direction;
      if (packet.progress >= 1 || packet.progress <= 0) {
        packet.direction *= -1;
        packet.progress = clamp(packet.progress, 0, 1);
        packet.pauseUntil = now + 1000;
      }
    }

    const x = fromNode.x + (toNode.x - fromNode.x) * packet.progress;
    const y = fromNode.y + (toNode.y - fromNode.y) * packet.progress;

    meshContext.beginPath();
    meshContext.fillStyle = "rgba(189, 182, 168, 0.8)";
    meshContext.arc(x, y, 2.6, 0, Math.PI * 2);
    meshContext.fill();

    meshContext.beginPath();
    meshContext.strokeStyle = "rgba(189, 182, 168, 0.8)";
    meshContext.lineWidth = 2;
    meshContext.setLineDash([2, 10]);
    const trailStartNode = packet.direction >= 0 ? fromNode : toNode;
    meshContext.moveTo(trailStartNode.x, trailStartNode.y);
    meshContext.lineTo(x, y);
    meshContext.stroke();
    meshContext.setLineDash([]);
  });
}

function updateOrbit() {
  if (!orbitOverlay || !orbitCircle || window.innerWidth <= 920) {
    return;
  }

  const desktopRect = document
    .querySelector(".desktop")
    .getBoundingClientRect();
  const centers = windows.map((windowElement) => {
    const rect = windowElement.getBoundingClientRect();
    return {
      x: rect.left - desktopRect.left + rect.width / 2,
      y: rect.top - desktopRect.top + rect.height / 2,
    };
  });

  const circle = getCircumcircle(centers[0], centers[1], centers[2]);
  if (!circle || !Number.isFinite(circle.radius) || circle.radius <= 0) {
    orbitCircle.setAttribute("visibility", "hidden");
    return;
  }

  orbitCircle.setAttribute("visibility", "visible");
  orbitCircle.setAttribute("cx", `${circle.x}`);
  orbitCircle.setAttribute("cy", `${circle.y}`);
  orbitCircle.setAttribute("r", `${circle.radius}`);
}

function getCircumcircle(a, b, c) {
  if (!a || !b || !c) {
    return null;
  }

  const determinant =
    2 *
    (a.x * (b.y - c.y) +
      b.x * (c.y - a.y) +
      c.x * (a.y - b.y));

  if (Math.abs(determinant) < 0.01) {
    return null;
  }

  const aSq = a.x * a.x + a.y * a.y;
  const bSq = b.x * b.x + b.y * b.y;
  const cSq = c.x * c.x + c.y * c.y;

  const x =
    (aSq * (b.y - c.y) +
      bSq * (c.y - a.y) +
      cSq * (a.y - b.y)) /
    determinant;
  const y =
    (aSq * (c.x - b.x) +
      bSq * (a.x - c.x) +
      cSq * (b.x - a.x)) /
    determinant;

  return {
    x,
    y,
    radius: Math.hypot(a.x - x, a.y - y),
  };
}
