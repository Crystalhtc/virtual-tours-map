const { useState, useEffect, useRef, useCallback } = React;

const IMG_W = window.__resources?.mapWidth || 7135;
const IMG_H = window.__resources?.mapHeight || 7374;

const PARKS = [
  { id: "wells-gray", name: "Wells Gray Park", region: "Thompson-Nicola", px: 66.99, py: 55.30, img: "https://admin.discoverparks.ca/assets/2354f702-2f65-4dd2-8671-37a21dd67eb9" },
  { id: "tsutswecw-park", name: "Tsútswecw Park", region: "Columbia Shuswap", px: 67.58, py: 60.51, img: "https://admin.discoverparks.ca/assets/c7adde8f-d359-460e-93a9-2a7b654a37b3" },
  { id: "kikomun-creek-park", name: "Kikomun Creek Park", region: "East Kootenay", px: 82.86, py: 64.70, img: "https://admin.discoverparks.ca/assets/c9b012e6-711c-4517-b36d-73c5e9872d8f" },
  { id: "goldstream-park", name: "Goldstream Park", region: "Victoria", px: 48.85, py: 69.07, img: "https://admin.discoverparks.ca/assets/d3ef58fb-e7d3-49b3-8fc0-9e11c6d6bb55" },
  { id: "cypress-park", name: "Cypress Park", region: "Greater Vancouver", px: 55.59, py: 66.74, img: "https://admin.discoverparks.ca/assets/1667b19b-9c04-43d1-a732-887d7169fd34" },
  { id: "manning-park", name: "Manning Park", region: "Fraser Valley", px: 63.24, py: 67.61, img: "https://admin.discoverparks.ca/assets/d5ca8c88-cb24-4c78-8a08-5cecf9c95d84" },
  { id: "macmillan-park", name: "MacMillan Park", region: "Nanaimo District", px: 45.66, py: 65.15, img: "https://admin.discoverparks.ca/assets/d10f9125-8e84-4c61-8352-9df3b66f14da" },
  { id: "stawamus-chief-park", name: "Stawamus Chief Park", region: "Squamish", px: 51.50, py: 64.50, img: "https://admin.discoverparks.ca/assets/ffc3455a-a53e-403f-8a3e-00f7f5dd3335" },
  { id: "porteau-cove-park", name: "Porteau Cove Park", region: "", px: 53.63, py: 65.86, img: "https://admin.discoverparks.ca/assets/2c776e13-f7a8-4ed0-89e3-7498871ccc24" },
  { id: "rathtrevor-beach-park", name: "Rathtrevor Beach Park", region: "", px: 47.91, py: 65.15, img: "https://admin.discoverparks.ca/assets/9fb159fd-b04b-401f-ad1a-966eed40ff9d" }
];

function PinSVG({ selected, pinScale = 1 }) {
  const width = 22 * pinScale;
  const height = 32 * pinScale;

  return (
    <svg
      className={`pin-svg ${selected ? "is-selected" : ""}`}
      width={width}
      height={height}
      viewBox="0 0 30 40"
    >
      <path
        d="M15 0C6.72 0 0 6.72 0 15C0 26 15 40 15 40C15 40 30 26 30 15C30 6.72 23.28 0 15 0Z"
        fill={selected ? "#E6FFA7" : "#FF7A65"}
      />
      <circle cx="15" cy="14" r="5.5" fill="white" opacity="0.88" />
    </svg>
  );
}

function App() {
  const appRef = useRef(null);
  const mapStageRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.1 });
  const transformRef = useRef({ x: 0, y: 0, scale: 0.1 });
  const baseMapScaleRef = useRef(0.1);
  const [selected, setSelected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(window.innerWidth <= 768);
  const [sheetState, setSheetState] = useState("default");
  const [mapSvg, setMapSvg] = useState("");
  const [stageSize, setStageSize] = useState({ width: 1, height: 1 });

  const animRef = useRef(null);
  const ptrs = useRef(new Map());
  const pinchRef = useRef(null);
  const dragRef = useRef({ active: false, moved: false, ox: 0, oy: 0 });
  const sheetDragRef = useRef({ active: false, startY: 0, state: "default" });

  const setTf = useCallback((val) => {
    const next = typeof val === "function" ? val(transformRef.current) : val;
    transformRef.current = next;
    setTransform(next);
  }, []);

  const initFit = useCallback(() => {
    const el = mapStageRef.current;
    if (!el) return;

    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const fitScale = Math.min(cw / IMG_W, ch / IMG_H);
    const scale = fitScale * (mobile ? 2.35 : 1.35);
    const sidebarSpace = mobile ? 0 : Math.min(440, Math.max(300, cw * 0.24));
    const viewportCenterX = sidebarSpace + (cw - sidebarSpace) / 2;
    const viewportCenterY = mobile ? 72 + (ch - 72 - 100) / 2 : ch / 2;
    const focusX = IMG_W * (mobile ? 0.60 : 0.56);
    const focusY = IMG_H * (mobile ? 0.66 : 0.48);
    const x = viewportCenterX - focusX * scale;
    const y = viewportCenterY - focusY * scale;

    baseMapScaleRef.current = scale;
    setStageSize({ width: cw, height: ch });

    setTf({
      x,
      y,
      scale
    });
  }, [mobile, setTf]);

  const zoomToward = useCallback((cx, cy, factor) => {
    setTf((t) => {
      const scale = Math.max(0.04, Math.min(2.5, t.scale * factor));
      const mx = (cx - t.x) / t.scale;
      const my = (cy - t.y) / t.scale;

      return {
        x: cx - mx * scale,
        y: cy - my * scale,
        scale
      };
    });
  }, [setTf]);

  const flyTo = useCallback((park) => {
    const el = mapStageRef.current;
    if (!el) return;

    const cw = el.clientWidth;
    const visibleHeight = mobile ? window.innerHeight - 72 - 100 : el.clientHeight;
    const centerY = mobile ? 72 + visibleHeight / 2 : el.clientHeight / 2;
    const targetScale = Math.min(cw, visibleHeight) / (IMG_W * 0.15);
    const safeScale = Math.max(0.08, Math.min(2.5, targetScale));
    const cx = IMG_W * (park.px / 100);
    const cy = IMG_H * (park.py / 100);
    const targetX = cw / 2 - cx * safeScale;
    const targetY = centerY - cy * safeScale;

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const duration = 650;
    const start = performance.now();
    const { x: startX, y: startY, scale: startScale } = transformRef.current;
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = ease(progress);

      setTf({
        x: startX + (targetX - startX) * eased,
        y: startY + (targetY - startY) * eased,
        scale: startScale + (safeScale - startScale) * eased
      });

      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        setSelected(park);
        animRef.current = null;
      }
    };

    setSelected(null);
    animRef.current = requestAnimationFrame(step);
    if (mobile) setSheetState("collapsed");
  }, [mobile, setTf]);

  const filtered = PARKS.filter((park) => {
    const term = query.toLowerCase();
    return park.name.toLowerCase().includes(term) || park.region.toLowerCase().includes(term);
  });

  useEffect(() => {
    const resize = () => {
      setMobile(window.innerWidth <= 768);
      initFit();
    };

    initFit();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [initFit]);

  useEffect(() => {
    const el = mapStageRef.current;
    if (!el || !window.ResizeObserver) return;

    const updateSize = () => {
      setStageSize({ width: el.clientWidth, height: el.clientHeight });
    };
    const observer = new ResizeObserver(updateSize);

    updateSize();
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const mapSrc = (window.__resources && window.__resources.mapBg) || "map-bg.png";

    fetch(mapSrc)
      .then((response) => response.ok ? response.text() : Promise.reject(new Error("Map SVG failed to load")))
      .then((svg) => {
        const cleanSvg = svg.replace(/<\?xml[^>]*>\s*/i, "");
        const innerSvg = cleanSvg
          .replace(/^[\s\S]*?<svg\b[^>]*>/i, "")
          .replace(/<\/svg>\s*$/i, "");

        if (active) setMapSvg(innerSvg);
      })
      .catch(() => {
        if (active) setMapSvg("");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const el = mapStageRef.current;
    if (!el) return;

    const handler = (event) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomToward(
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.deltaY < 0 ? 1.14 : 1 / 1.14
      );
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [zoomToward]);

  const onPointerDown = (event) => {
    if (event.target.closest("[data-pin]")) return;

    ptrs.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { active: true, moved: false, ox: event.clientX, oy: event.clientY };
  };

  const onPointerMove = (event) => {
    const prev = ptrs.current.get(event.pointerId);
    if (!prev) return;

    const cur = { x: event.clientX, y: event.clientY };

    if (Math.hypot(cur.x - dragRef.current.ox, cur.y - dragRef.current.oy) > 4) {
      dragRef.current.moved = true;
      if (selected) setSelected(null);
    }

    if (ptrs.current.size <= 1 && dragRef.current.active) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      setTf((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    } else if (ptrs.current.size === 2) {
      const pts = [...ptrs.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

      if (pinchRef.current !== null && dist > 0) {
        const cx = (pts[0].x + pts[1].x) / 2;
        const cy = (pts[0].y + pts[1].y) / 2;
        const rect = mapStageRef.current.getBoundingClientRect();
        zoomToward(cx - rect.left, cy - rect.top, dist / pinchRef.current);
      }

      pinchRef.current = dist;
    }

    ptrs.current.set(event.pointerId, cur);
  };

  const onPointerUp = (event) => {
    ptrs.current.delete(event.pointerId);
    if (ptrs.current.size < 2) pinchRef.current = null;

    if (ptrs.current.size === 0) {
      dragRef.current.active = false;
      dragRef.current.moved = false;
    }
  };

  const onHandlePointerDown = (event) => {
    sheetDragRef.current = { active: true, startY: event.clientY, state: sheetState };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event) => {
    if (!sheetDragRef.current.active) return;

    const dy = event.clientY - sheetDragRef.current.startY;
    const state = sheetDragRef.current.state;

    if (dy > 60 && state !== "collapsed") {
      setSheetState(state === "expanded" ? "default" : "collapsed");
      sheetDragRef.current.active = false;
    } else if (dy < -60 && state !== "expanded") {
      setSheetState(state === "collapsed" ? "default" : "expanded");
      sheetDragRef.current.active = false;
    }
  };

  const zoomIn = () => {
    const rect = mapStageRef.current.getBoundingClientRect();
    zoomToward(rect.width / 2, rect.height / 2, 1.3);
  };

  const zoomOut = () => {
    const rect = mapStageRef.current.getBoundingClientRect();
    zoomToward(rect.width / 2, rect.height / 2, 1 / 1.3);
  };

  const stageBottom = mobile
    ? sheetState === "expanded" ? "80%" : sheetState === "default" ? "45%" : "100px"
    : "0";
  const sheetHeight = sheetState === "expanded" ? "80%" : sheetState === "default" ? "45%" : "100px";
  const isCollapsed = sheetState === "collapsed";
  const pinZoomRatio = Math.sqrt(transform.scale / baseMapScaleRef.current);
  const pinScreenScale = Math.max(0.75, Math.min(1.6, pinZoomRatio));
  const pinScale = pinScreenScale;
  const popupScale = Math.max(0.72, Math.min(1, pinZoomRatio));
  const mapViewBox = [
    -transform.x / transform.scale,
    -transform.y / transform.scale,
    stageSize.width / transform.scale,
    stageSize.height / transform.scale
  ].join(" ");

  return (
    <div ref={appRef} className="app-shell">
      <div
        ref={mapStageRef}
        className="map-stage"
        style={{ "--stage-top": mobile ? "72px" : "0", "--stage-bottom": stageBottom }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => setSelected(null)}
      >
        {mapSvg ? (
          <svg
            className="map-svg"
            viewBox={mapViewBox}
            aria-label="BC Parks Map"
            dangerouslySetInnerHTML={{ __html: mapSvg }}
          />
        ) : (
          <div
            className="map-inner"
            style={{
              "--map-width": `${IMG_W}px`,
              "--map-height": `${IMG_H}px`,
              "--map-transform": `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
            }}
          >
            <img
              src={(window.__resources && window.__resources.mapBg) || "map-bg.png"}
              alt="BC Parks Map"
              width={IMG_W}
              height={IMG_H}
              draggable={false}
            />
          </div>
        )}

        <div className="pin-overlay">
          {PARKS.map((park) => {
            const pinX = transform.x + IMG_W * park.px / 100 * transform.scale;
            const pinY = transform.y + IMG_H * park.py / 100 * transform.scale;

            return (
              <div
                key={park.id}
                className="park-pin"
                data-pin="true"
                style={{ "--pin-left": `${pinX}px`, "--pin-top": `${pinY}px` }}
                onClick={(event) => {
                  event.stopPropagation();
                  flyTo(park);
                }}
              >
                <PinSVG selected={selected?.id === park.id} pinScale={pinScale} />
              </div>
            );
          })}
        </div>
      </div>

      {mobile && <MobileBranding />}

      {!mobile && (
        <>
          {!sidebarOpen && (
            <MenuButton className="toggle-btn-float" onClick={() => setSidebarOpen(true)} />
          )}

          <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
            <div className="sidebar-header">
              <div className="sidebar-title-row">
                <MenuButton className="toggle-btn" onClick={() => setSidebarOpen(false)} />
                <h1 className="sidebar-title">Virtual Tours</h1>
              </div>
              <SearchBar value={query} onChange={setQuery} />
            </div>

            <div className="park-list-scroll">
              <ParkList parks={filtered} selected={selected} onSelect={flyTo} />
            </div>

            <Branding className="sidebar-branding" />
          </aside>
        </>
      )}

      {mobile && (
        <section className="bottom-sheet" style={{ "--sheet-height": sheetHeight }}>
          <div
            className="sheet-handle-area"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={() => { sheetDragRef.current.active = false; }}
          >
            <button
              className="sheet-handle-button"
              type="button"
              onClick={() => setSheetState((state) => state === "collapsed" ? "default" : "collapsed")}
              aria-label="Toggle tour list"
            >
              <span className="sheet-handle" />
            </button>
            <button
              className="sheet-title"
              type="button"
              onClick={() => setSheetState((state) => state === "collapsed" ? "default" : "collapsed")}
            >
              Virtual Tours
            </button>
            <div onClick={() => isCollapsed && setSheetState("default")}>
              <SearchBar
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  if (isCollapsed) setSheetState("default");
                }}
              />
            </div>
          </div>

          {!isCollapsed && (
            <>
              <div className="sheet-divider" />
              <div className="park-list-scroll">
                <ParkList parks={filtered} selected={selected} onSelect={flyTo} />
              </div>
            </>
          )}
        </section>
      )}

      {selected && (
        <ParkPopup
          park={selected}
          pos={{
            x: transform.x + IMG_W * selected.px / 100 * transform.scale,
            y: transform.y + IMG_H * selected.py / 100 * transform.scale + (mobile ? 72 : 0)
          }}
          minBottom={mobile ? getMobilePopupBottom(sheetState) : 0}
          scale={popupScale}
          onClose={() => setSelected(null)}
        />
      )}

      {!mobile && (
        <div className="zoom-controls">
          <button className="zoom-btn" type="button" onClick={zoomIn}>+</button>
          <div className="zoom-divider" />
          <button className="zoom-btn" type="button" onClick={zoomOut}>-</button>
        </div>
      )}
    </div>
  );
}

function getMobilePopupBottom(sheetState) {
  const sheetBottom = sheetState === "expanded"
    ? window.innerHeight * 0.80
    : sheetState === "default"
      ? window.innerHeight * 0.45
      : 100;

  return sheetBottom + 12;
}

function MenuButton({ className, onClick }) {
  return (
    <button className={className} type="button" onClick={onClick} aria-label="Toggle menu">
      <svg width="17" height="13" viewBox="0 0 17 13" fill="none" aria-hidden="true">
        <rect y="0" width="17" height="2" rx="1" fill="#E6FFA7" />
        <rect y="5.5" width="11" height="2" rx="1" fill="#E6FFA7" />
        <rect y="11" width="14" height="2" rx="1" fill="#E6FFA7" />
      </svg>
    </button>
  );
}

function Branding({ className = "" }) {
  return (
    <div className={className}>
      <img className="brand-logo" src="images/logo.svg" alt="Discover Parks by BC Parks Foundation" />
    </div>
  );
}

function MobileBranding() {
  return (
    <header className="mobile-branding">
      <Branding />
    </header>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div className="search">
      <svg className="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
        <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        placeholder="Search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ParkList({ parks, selected, onSelect }) {
  if (!parks.length) {
    return <div className="empty-list">No parks found</div>;
  }

  return (
    <div>
      {parks.map((park, index) => (
        <div
          key={park.id}
          className={`park-row ${index === parks.length - 1 ? "is-last" : ""}`}
          onClick={() => onSelect(park)}
        >
          <span className={`park-row-name ${selected?.id === park.id ? "is-selected" : ""}`}>
            {park.name}
          </span>
          <a href={`https://virtual-tours.discoverparks.ca/${park.id}/`} className="explore-pill" target="_blank">
            Explore 
            <span className="arrow">
                <svg width="16" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.37109 10H18.3711" stroke="#401C1E" stroke-linecap="round"></path><path d="M13.3711 15L18.3711 10L13.3711 5" stroke="#401C1E" stroke-linecap="round"></path></svg>
            </span>
          </a>
        </div>
      ))}
    </div>
  );
}

function ParkPopup({ park, pos, onClose, minBottom = 0, scale = 1 }) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const baseWidth = 305;
  const width = Math.min(Math.round(baseWidth * scale), viewportWidth - 24);
  const actualScale = width / baseWidth;
  const imageHeight = Math.round(170 * actualScale);
  const infoHeight = Math.round(76 * actualScale);
  const totalHeight = imageHeight + infoHeight;
  const minTop = minBottom > 0 ? 80 : 8;
  let left = pos.x - width / 2;
  let top = pos.y - totalHeight - Math.round(18 * actualScale);

  left = Math.max(8, Math.min(left, viewportWidth - width - 8));
  top = Math.max(minTop, Math.min(top, viewportHeight - totalHeight - minBottom - 8));

  if (top + totalHeight > viewportHeight - minBottom - 8) {
    top = viewportHeight - minBottom - totalHeight - 8;
  }

  return (
    <div
      className="park-popup"
      style={{
        "--popup-left": `${left}px`,
        "--popup-top": `${top}px`,
        "--popup-width": `${width}px`,
        "--popup-image-height": `${imageHeight}px`,
        "--popup-info-height": `${infoHeight}px`,
        "--popup-radius": `${Math.round(14 * actualScale)}px`,
        "--popup-content-padding": `${Math.round(12 * actualScale)}px ${Math.round(16 * actualScale)}px`,
        "--popup-region-font": `${Math.max(9, Math.round(10 * actualScale))}px`,
        "--popup-name-font": `${Math.max(12, Math.round(15 * actualScale))}px`,
        "--popup-link-font": `${Math.max(11, Math.round(13 * actualScale))}px`,
        "--popup-link-padding": `${Math.round(7 * actualScale)}px ${Math.round(16 * actualScale)}px`,
        "--popup-close-size": `${Math.round(28 * actualScale)}px`,
        "--popup-close-offset": `${Math.round(10 * actualScale)}px`,
        "--popup-close-font": `${Math.max(11, Math.round(13 * actualScale))}px`,
        "--popup-close-icon-size": `${Math.max(9, Math.round(12 * actualScale))}px`
      }}
    >
      <div className="popup-image-wrap">
        <img className="popup-image" src={park.img} alt={park.name} />
        <div className="popup-image-shade" />
        <button className="popup-close" type="button" onClick={onClose} aria-label="Close popup">
          <svg aria-hidden="true" focusable="false" width="10" height="10" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" fill="white" d="M7.41401 6.00012L11.707 1.70721C12.098 1.31622 12.098 0.684236 11.707 0.293244C11.316 -0.097748 10.684 -0.097748 10.293 0.293244L6.00001 4.58615L1.70701 0.293244C1.31601 -0.097748 0.684006 -0.097748 0.293006 0.293244C-0.0979941 0.684236 -0.0979941 1.31622 0.293006 1.70721L4.58601 6.00012L0.293006 10.293C-0.0979941 10.684 -0.0979941 11.316 0.293006 11.707C0.488006 11.902 0.744006 12 1.00001 12C1.25601 12 1.51201 11.902 1.70701 11.707L6.00001 7.4141L10.293 11.707C10.488 11.902 10.744 12 11 12C11.256 12 11.512 11.902 11.707 11.707C12.098 11.316 12.098 10.684 11.707 10.293L7.41401 6.00012Z" />
          </svg>
        </button>
      </div>
      <div className="popup-content">
        <div>
          <div className="popup-region">{park.region}</div>
          <div className="popup-name">{park.name}</div>
        </div>
        <a href={`https://virtual-tours.discoverparks.ca/${park.id}/`} className="explore-pill popup-link" target="_blank">
          Explore 
          <span className="arrow">
              <svg width="16" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.37109 10H18.3711" stroke="#401C1E" stroke-linecap="round"></path><path d="M13.3711 15L18.3711 10L13.3711 5" stroke="#401C1E" stroke-linecap="round"></path></svg>
          </span>
        </a>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
