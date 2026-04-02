import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  BoxGeometry,
  LinearFilter,
} from 'three';
import { AnalogClockFallback } from '../features/clocks/components/AnalogClockFallback';
import type { ThemePalette } from '../types/theme';

type AlarmMiniClock = {
  hourHand: Group;
  minuteHand: Group;
  frameMaterial: MeshStandardMaterial;
  faceMaterial: MeshStandardMaterial;
  markerMaterials: MeshBasicMaterial[];
  handMaterials: MeshStandardMaterial[];
};

function drawTextSprite(
  canvas: HTMLCanvasElement,
  value: string | string[],
  color: string,
  font: string,
  options?: {
    outlineColor?: string;
    outlineWidth?: number;
  },
) {
  const context = canvas.getContext('2d');

  if (!context) {
    return false;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const lines = Array.isArray(value) ? value : [value];
  const fontSizeMatch = font.match(/(\d+)px/);
  const fontSize = fontSizeMatch ? Number(fontSizeMatch[1]) : 32;
  const lineHeight = fontSize * 1.02;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    if (options?.outlineColor && options.outlineWidth) {
      context.strokeStyle = options.outlineColor;
      context.lineWidth = options.outlineWidth;
      context.lineJoin = 'round';
      context.miterLimit = 2;
      context.strokeText(line, canvas.width / 2, y);
    }
    context.fillText(line, canvas.width / 2, y);
  });
  return true;
}

function createHand(
  width: number,
  length: number,
  depth: number,
  fill: string,
  outline: string,
) {
  const hand = new Group();

  const outlineMesh = new Mesh(
    new BoxGeometry(width + 0.03, length + 0.03, depth + 0.015),
    new MeshStandardMaterial({
      color: outline,
      roughness: 0.3,
      metalness: 0.18,
    }),
  );
  outlineMesh.position.y = length / 2;
  outlineMesh.position.z = 0.005;

  const handMesh = new Mesh(
    new BoxGeometry(width, length, depth),
    new MeshStandardMaterial({ color: fill }),
  );
  handMesh.position.y = length / 2;
  handMesh.position.z = 0.02;

  hand.add(outlineMesh, handMesh);
  return hand;
}

function createOverlayHand(
  width: number,
  length: number,
  depth: number,
  fill: string,
  outline: string,
  clippingPlanes: Plane[],
) {
  const hand = new Group();

  const outlineMesh = new Mesh(
    new BoxGeometry(width + 0.03, length + 0.03, depth + 0.015),
    new MeshStandardMaterial({
      color: outline,
      roughness: 0.28,
      metalness: 0.12,
      clippingPlanes,
      clipIntersection: true,
      depthTest: false,
    }),
  );
  outlineMesh.position.y = length / 2;
  outlineMesh.position.z = 0.09;

  const handMesh = new Mesh(
    new BoxGeometry(width, length, depth),
    new MeshStandardMaterial({
      color: fill,
      clippingPlanes,
      clipIntersection: true,
      depthTest: false,
    }),
  );
  handMesh.position.y = length / 2;
  handMesh.position.z = 0.1;

  hand.renderOrder = 10;
  hand.add(outlineMesh, handMesh);
  return hand;
}

function createNumberSprite(
  value: string,
  x: number,
  y: number,
  color: string,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;

  if (!drawTextSprite(canvas, value, color, '700 64px "Segoe UI", sans-serif')) {
    return null;
  }

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
  });

  const sprite = new Sprite(material);
  sprite.scale.set(0.19, 0.19, 1);
  sprite.position.set(x, y, 0.05);
  return sprite;
}

function formatDateLabel(currentTime: Date) {
  const capitalizeWords = (value: string) =>
    value
      .split(/\s+/)
      .map((word) =>
        word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word,
      )
      .join(' ');

  const weekday = capitalizeWords(
    currentTime.toLocaleDateString('fr-FR', { weekday: 'long' }),
  );
  const day = currentTime.toLocaleDateString('fr-FR', { day: 'numeric' });
  const month = capitalizeWords(
    currentTime.toLocaleDateString('fr-FR', { month: 'long' }),
  );

  return [weekday, day, month];
}

function normalizeTurnDistance(turnFraction: number, target: number) {
  const delta = Math.abs(((turnFraction - target + 0.5) % 1) - 0.5);
  return delta;
}

function isHandCrossingDateZone(turnFraction: number, handLength: number) {
  const dateZoneCenter = 0;
  const dateZoneHalfWidth = 0.14;
  const dateZoneInnerRadius = 0.16;

  return (
    handLength >= dateZoneInnerRadius &&
    normalizeTurnDistance(turnFraction, dateZoneCenter) <= dateZoneHalfWidth
  );
}

function getDateTextColor(_theme: ThemePalette, currentTime: Date) {
  const hours = currentTime.getHours() % 12;
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();
  const milliseconds = currentTime.getMilliseconds();

  const secondsProgress = (seconds + milliseconds / 1000) / 60;
  const minutesProgress = (minutes + secondsProgress) / 60;
  const hoursProgress = (hours + minutesProgress) / 12;

  const isOverlapping =
    isHandCrossingDateZone(hoursProgress, 0.5) ||
    isHandCrossingDateZone(minutesProgress, 0.76) ||
    isHandCrossingDateZone(secondsProgress, 0.82);

  return isOverlapping ? '#ffffff' : '#ffffff';
}

function getMiniClockPalette(
  theme: ThemePalette,
  accentColor?: string,
) {
  if (accentColor) {
    return {
      frame: theme.PANEL,
      face: theme.BG,
      marks: theme.FG,
      hands: accentColor,
      handOutline: theme.BG,
    };
  }

  return {
    frame: '#666666',
    face: '#2d2d2d',
    marks: '#8b8b8b',
    hands: '#9a9a9a',
    handOutline: '#2d2d2d',
  };
}

function applyMiniClockPalette(miniClock: AlarmMiniClock, palette: ReturnType<typeof getMiniClockPalette>) {
  miniClock.frameMaterial.color.set(palette.frame);
  miniClock.faceMaterial.color.set(palette.face);
  miniClock.markerMaterials.forEach((material) => {
    material.color.set(palette.marks);
  });
  miniClock.handMaterials.forEach((material) => {
    material.color.set(palette.hands);
  });
}

function createDateSprite(currentTime: Date, color: string, outlineColor: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 448;

  const value = formatDateLabel(currentTime);
  if (
    !drawTextSprite(canvas, value, color, '700 84px "Segoe UI", sans-serif', {
      outlineColor,
      outlineWidth: 8,
    })
  ) {
    return null;
  }

  const texture = new CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
  });

  const sprite = new Sprite(material);
  sprite.scale.set(0.82, 0.5, 1);
  sprite.position.set(0, 0.32, 0.05);
  return sprite;
}

function createMarker(angle: number, radius: number, length: number, width: number) {
  const marker = new Mesh(
    new PlaneGeometry(width, length),
    new MeshBasicMaterial({ color: '#ffffff' }),
  );

  marker.position.set(
    Math.sin(angle) * radius,
    Math.cos(angle) * radius,
    0.04,
  );
  marker.rotation.z = -angle;

  return marker;
}

function createCircularClippingPlanes(centerX: number, centerY: number, radius: number) {
  const segments = 12;
  const planes: Plane[] = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const normal = new Vector3(Math.cos(angle), Math.sin(angle), 0);
    const pointX = centerX + Math.cos(angle) * radius;
    const pointY = centerY + Math.sin(angle) * radius;
    const constant = -(normal.x * pointX + normal.y * pointY);

    planes.push(new Plane(normal, constant));
  }

  return planes;
}

function getAlarmPreviewDate(alarmTime: string) {
  const [hoursText = '0', minutesText = '0'] = alarmTime.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const previewDate = new Date();

  previewDate.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );

  return previewDate;
}

const MINI_CLOCK_RADIUS = Math.hypot(0.31, 0.24);
const MINI_CLOCK_ANCHOR_ANGLE = Math.atan2(0.31, -0.24);

function getAngularDistance(angleA: number, angleB: number) {
  const delta = Math.abs(angleA - angleB) % (Math.PI * 2);
  return Math.min(delta, Math.PI * 2 - delta);
}

function isAngleBlocked(angle: number, showDate: boolean) {
  if (!showDate) {
    return false;
  }

  const topCenterAngle = 0;
  const blockedHalfWidth = 0.52;
  return getAngularDistance(angle, topCenterAngle) < blockedHalfWidth;
}

function getMiniClockAngles(total: number, showDate: boolean) {
  if (total <= 0) {
    return [];
  }

  const angles = [MINI_CLOCK_ANCHOR_ANGLE];
  const candidates = Array.from({ length: 180 }, (_, index) => (index / 180) * Math.PI * 2).filter(
    (angle) => !isAngleBlocked(angle, showDate),
  );

  while (angles.length < total) {
    let bestAngle = MINI_CLOCK_ANCHOR_ANGLE;
    let bestDistance = -1;

    candidates.forEach((candidateAngle) => {
      if (angles.some((angle) => getAngularDistance(angle, candidateAngle) < 0.08)) {
        return;
      }

      const nearestNeighborDistance = Math.min(
        ...angles.map((angle) => getAngularDistance(angle, candidateAngle)),
      );

      if (nearestNeighborDistance > bestDistance) {
        bestDistance = nearestNeighborDistance;
        bestAngle = candidateAngle;
      }
    });

    angles.push(bestAngle);
  }

  return angles;
}

function getMiniClockScale(total: number) {
  if (total <= 1) {
    return 1;
  }

  if (total === 2) {
    return 0.9;
  }

  if (total === 3) {
    return 0.78;
  }

  if (total === 4) {
    return 0.68;
  }

  return 0.6;
}

function createAlarmMiniClock(
  theme: ThemePalette,
  alarmTime: string,
  alarmColor: string | undefined,
  angle: number,
  scale: number,
) {
  const miniTheme = getMiniClockPalette(theme, alarmColor);

  const frameMaterial = new MeshStandardMaterial({
    color: miniTheme.frame,
    metalness: 0.18,
    roughness: 0.68,
  });
  const frame = new Mesh(
    new RingGeometry(0.14, 0.152, 64),
    frameMaterial,
  );

  const faceMaterial = new MeshStandardMaterial({ color: miniTheme.face, roughness: 0.92 });
  const face = new Mesh(
    new CircleGeometry(0.137, 64),
    faceMaterial,
  );
  face.position.z = 0.002;

  const markers = new Group();
  const markerMaterials: MeshBasicMaterial[] = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const marker = createMarker(angle, 0.117, 0.018, 0.005);
    const material = marker.material;
    if (material instanceof MeshBasicMaterial) {
      material.color.set(miniTheme.marks);
      markerMaterials.push(material);
    }
    markers.add(marker);
  }

  const handOutline = miniTheme.handOutline;
  const hourHand = createHand(0.012, 0.068, 0.01, miniTheme.hands, handOutline);
  const minuteHand = createHand(0.008, 0.098, 0.008, miniTheme.hands, handOutline);
  const handMaterials = [hourHand.children[1], minuteHand.children[1]]
    .map((child) => (child instanceof Mesh ? child.material : null))
    .filter((material): material is MeshStandardMaterial => material instanceof MeshStandardMaterial);

  const group = new Group();
  group.position.set(Math.sin(angle) * MINI_CLOCK_RADIUS, Math.cos(angle) * MINI_CLOCK_RADIUS, 0.03);
  group.scale.setScalar(scale);
  group.add(frame, face, markers, hourHand, minuteHand);

  const previewDate = getAlarmPreviewDate(alarmTime);
  const hours = previewDate.getHours() % 12;
  const minutes = previewDate.getMinutes();
  const minutesProgress = minutes / 60;
  const hoursProgress = (hours + minutesProgress) / 12;

  hourHand.rotation.z = getClockRotation(hoursProgress);
  minuteHand.rotation.z = getClockRotation(minutesProgress);

  return {
    group,
    miniClock: {
      hourHand,
      minuteHand,
      frameMaterial,
      faceMaterial,
      markerMaterials,
      handMaterials,
    },
  };
}

function createClockScene(
  scene: Scene,
  theme: ThemePalette,
  currentTime: Date,
  alarmPreviews: Array<{ time: string; color: string }>,
  showDate: boolean,
) {
  const frame = new Mesh(
    new RingGeometry(0.91, 0.919, 96),
    new MeshStandardMaterial({ color: theme.ACCENT, metalness: 0.22, roughness: 0.62 }),
  );

  const face = new Mesh(
    new CircleGeometry(0.895, 96),
    new MeshStandardMaterial({ color: theme.BG, roughness: 0.88 }),
  );

  const handOutline = theme.BG;
  const handColor = theme.ACCENT;
  const hourHand = createHand(0.043, 0.5, 0.022, handColor, handOutline);
  const minuteHand = createHand(0.028, 0.76, 0.018, handColor, handOutline);
  const secondHand = createHand(0.012, 0.82, 0.012, handColor, handOutline);

  const markers = new Group();
  for (let index = 0; index < 60; index += 1) {
    const angle = (index / 60) * Math.PI * 2;
    const isHourMarker = index % 5 === 0;

    markers.add(
      createMarker(
        angle,
        0.85,
        isHourMarker ? 0.087 : 0.065,
        isHourMarker ? 0.018 : 0.008,
      ),
    );

    const markerMaterial = markers.children[index];
    if (markerMaterial instanceof Mesh) {
      const material = markerMaterial.material;
      if (material instanceof MeshBasicMaterial) {
        material.color.set(theme.FG);
      }
    }
  }

  const numbers = new Group();
  const numberRadius = 0.69;
  const labels = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
  labels.forEach((label, index) => {
    const angle = (index / 12) * Math.PI * 2;
    const sprite = createNumberSprite(
      label,
      Math.sin(angle) * numberRadius,
      Math.cos(angle) * numberRadius,
      theme.FG,
    );

    if (sprite) {
      numbers.add(sprite);
    }
  });

  const dateSprite = createDateSprite(
    currentTime,
    getDateTextColor(theme, currentTime),
    theme.ACCENT,
  );
  const miniClockAngles = getMiniClockAngles(alarmPreviews.length, showDate);
  const miniClockScale = getMiniClockScale(alarmPreviews.length);
  const alarmMiniClocks = alarmPreviews.map((alarmPreview, index) =>
    createAlarmMiniClock(
      theme,
      alarmPreview.time,
      alarmPreview.color,
      miniClockAngles[index] ?? MINI_CLOCK_ANCHOR_ANGLE,
      miniClockScale,
    ),
  );

  const group = new Group();
  group.add(frame, face, markers, numbers, hourHand, minuteHand, secondHand);
  if (dateSprite) {
    group.add(dateSprite);
  }
  alarmMiniClocks.forEach(({ group: alarmMiniClockGroup }) => {
    group.add(alarmMiniClockGroup);
  });
  scene.add(group);

  return {
    hourHand,
    minuteHand,
    secondHand,
    dateSprite,
    alarmMiniClocks: alarmMiniClocks.map(({ miniClock }) => miniClock),
  };
}

function getClockRotation(turnFraction: number) {
  return -(Math.PI * 2 * turnFraction);
}

function updateClockHands(
  hourHand: Group,
  minuteHand: Group,
  secondHand: Group,
  currentTime: Date,
) {
  const hours = currentTime.getHours() % 12;
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();
  const milliseconds = currentTime.getMilliseconds();

  const secondsProgress = (seconds + milliseconds / 1000) / 60;
  const minutesProgress = (minutes + secondsProgress) / 60;
  const hoursProgress = (hours + minutesProgress) / 12;

  hourHand.rotation.z = getClockRotation(hoursProgress);
  minuteHand.rotation.z = getClockRotation(minutesProgress);
  secondHand.rotation.z = getClockRotation(secondsProgress);
}

type ThreeClockPreviewProps = {
  currentTime: Date;
  theme: ThemePalette;
  alarmPreviews?: Array<{
    time: string;
    color: string;
  }>;
  showDate?: boolean;
};

function getResponsiveCameraDistance(aspect: number, showDate: boolean) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const verticalHalfSize = showDate ? 1.08 : 0.98;
  const horizontalHalfSize = 1.02;
  const halfFovRadians = (31 * Math.PI) / 360;
  const fitHeightDistance = verticalHalfSize / Math.tan(halfFovRadians);
  const fitWidthDistance = horizontalHalfSize / (Math.tan(halfFovRadians) * safeAspect);

  return Math.max(fitHeightDistance, fitWidthDistance, 3.8);
}

export function ThreeClockPreview({
  currentTime,
  theme,
  alarmPreviews = [],
  showDate = false,
}: ThreeClockPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const hourHandRef = useRef<Group | null>(null);
  const minuteHandRef = useRef<Group | null>(null);
  const secondHandRef = useRef<Group | null>(null);
  const overlayHourHandRef = useRef<Group | null>(null);
  const overlayMinuteHandRef = useRef<Group | null>(null);
  const overlaySecondHandRef = useRef<Group | null>(null);
  const dateSpriteRef = useRef<Sprite | null>(null);
  const alarmMiniClocksRef = useRef<AlarmMiniClock[]>([]);

  useEffect(() => {
    const mountNode = mountRef.current;

    if (!mountNode) {
      return;
    }

    let renderer: WebGLRenderer | null = null;
    let cleanupMountNode: HTMLDivElement | null = null;
    let frameId = 0;
    let resize: (() => void) | null = null;

    try {
      const scene = new Scene();
      scene.background = new Color(theme.BG);

      const camera = new PerspectiveCamera(31, 1, 0.1, 100);
      camera.position.set(0, 0, 3.34);

      renderer = new WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.localClippingEnabled = true;

      const light = new AmbientLight('#ffffff', 3.1);
      scene.add(light);

      const { hourHand, minuteHand, secondHand, dateSprite, alarmMiniClocks } = createClockScene(
        scene,
        theme,
        currentTime,
        alarmPreviews,
        showDate,
      );
      hourHandRef.current = hourHand;
      minuteHandRef.current = minuteHand;
      secondHandRef.current = secondHand;
      dateSpriteRef.current = dateSprite ?? null;
      if (dateSpriteRef.current) {
        dateSpriteRef.current.visible = showDate;
      }
      alarmMiniClocksRef.current = alarmMiniClocks;
      updateClockHands(hourHand, minuteHand, secondHand, currentTime);
      alarmMiniClocks.forEach((miniClock, index) => {
        applyMiniClockPalette(
          miniClock,
          getMiniClockPalette(theme, alarmPreviews[index]?.color),
        );
      });

      try {
        const clippingPlanes = createCircularClippingPlanes(0.31, -0.24, 0.152);
        const overlayFill = theme.ACCENT;
        const overlayOutline = theme.BG;

        const overlayHourHand = createOverlayHand(
          0.043,
          0.5,
          0.022,
          overlayFill,
          overlayOutline,
          clippingPlanes,
        );
        const overlayMinuteHand = createOverlayHand(
          0.028,
          0.76,
          0.018,
          overlayFill,
          overlayOutline,
          clippingPlanes,
        );
        const overlaySecondHand = createOverlayHand(
          0.012,
          0.82,
          0.012,
          overlayFill,
          overlayOutline,
          clippingPlanes,
        );

        overlayHourHandRef.current = overlayHourHand;
        overlayMinuteHandRef.current = overlayMinuteHand;
        overlaySecondHandRef.current = overlaySecondHand;
        updateClockHands(overlayHourHand, overlayMinuteHand, overlaySecondHand, currentTime);
        scene.add(overlayHourHand, overlayMinuteHand, overlaySecondHand);
      } catch {
        overlayHourHandRef.current = null;
        overlayMinuteHandRef.current = null;
        overlaySecondHandRef.current = null;
      }

      resize = () => {
        const size = new Vector2(mountNode.clientWidth, mountNode.clientHeight);
        renderer?.setSize(size.x, size.y);
        camera.aspect = size.x / size.y;
        camera.position.z = getResponsiveCameraDistance(camera.aspect, showDate);
        camera.updateProjectionMatrix();
      };

      resize();
      mountNode.appendChild(renderer.domElement);
      cleanupMountNode = mountNode;
      setRenderFailed(false);

      const animate = () => {
        renderer?.render(scene, camera);
        frameId = window.requestAnimationFrame(animate);
      };

      animate();
      window.addEventListener('resize', resize);

      return () => {
        if (resize) {
          window.removeEventListener('resize', resize);
        }
        window.cancelAnimationFrame(frameId);
        if (cleanupMountNode && renderer?.domElement.parentNode === cleanupMountNode) {
          cleanupMountNode.removeChild(renderer.domElement);
        }
        renderer?.dispose();
        scene.clear();
        hourHandRef.current = null;
        minuteHandRef.current = null;
        secondHandRef.current = null;
        overlayHourHandRef.current = null;
        overlayMinuteHandRef.current = null;
        overlaySecondHandRef.current = null;
        dateSpriteRef.current = null;
        alarmMiniClocksRef.current = [];
      };
    } catch {
      setRenderFailed(true);
      renderer?.dispose();
    }
  }, [theme, alarmPreviews, showDate]);

  useEffect(() => {
    if (!hourHandRef.current || !minuteHandRef.current || !secondHandRef.current) {
      return;
    }

    updateClockHands(
      hourHandRef.current,
      minuteHandRef.current,
      secondHandRef.current,
      currentTime,
    );

    if (overlayHourHandRef.current && overlayMinuteHandRef.current && overlaySecondHandRef.current) {
      updateClockHands(
        overlayHourHandRef.current,
        overlayMinuteHandRef.current,
        overlaySecondHandRef.current,
        currentTime,
      );
    }

    const dateSprite = dateSpriteRef.current;
    if (!dateSprite) {
      return;
    }

    const material = dateSprite.material;
    if (!(material instanceof SpriteMaterial) || !(material.map instanceof CanvasTexture)) {
      return;
    }

    drawTextSprite(
      material.map.image,
      formatDateLabel(currentTime),
      getDateTextColor(theme, currentTime),
      '700 84px "Segoe UI", sans-serif',
      {
        outlineColor: theme.ACCENT,
        outlineWidth: 8,
      },
    );
    material.map.needsUpdate = true;
  }, [currentTime, theme]);

  useEffect(() => {
    if (dateSpriteRef.current) {
      dateSpriteRef.current.visible = showDate;
    }
  }, [showDate]);

  useEffect(() => {
    if (alarmMiniClocksRef.current.length === 0) {
      return;
    }
    alarmMiniClocksRef.current.forEach((miniClock, index) => {
      const previewDate = getAlarmPreviewDate(alarmPreviews[index]?.time ?? '00:00');
      const hours = previewDate.getHours() % 12;
      const minutes = previewDate.getMinutes();
      const minutesProgress = minutes / 60;
      const hoursProgress = (hours + minutesProgress) / 12;

      miniClock.hourHand.rotation.z = getClockRotation(hoursProgress);
      miniClock.minuteHand.rotation.z = getClockRotation(minutesProgress);
    });
  }, [alarmPreviews]);

  if (renderFailed) {
    return (
      <AnalogClockFallback
        currentTime={currentTime}
        theme={theme}
        alarmPreviews={alarmPreviews}
        showDate={showDate}
      />
    );
  }

  return <div className="three-preview" ref={mountRef} />;
}
