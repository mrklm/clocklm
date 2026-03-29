import { useEffect, useRef } from 'react';
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
  PlaneGeometry,
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  WebGLRenderer,
  BoxGeometry,
} from 'three';
import type { ThemePalette } from '../types/theme';

function drawTextSprite(
  canvas: HTMLCanvasElement,
  value: string | string[],
  color: string,
  font: string,
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
  const lineHeight = fontSize * 1.1;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, startY + index * lineHeight);
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
  const weekday = currentTime
    .toLocaleDateString('fr-FR', { weekday: 'long' })
    .replace(/\b(\p{L})/gu, (match) => match.toUpperCase());
  const day = currentTime.toLocaleDateString('fr-FR', { day: 'numeric' });
  const month = currentTime
    .toLocaleDateString('fr-FR', { month: 'long' })
    .replace(/\b(\p{L})/gu, (match) => match.toUpperCase());

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

function getDateTextColor(theme: ThemePalette, currentTime: Date) {
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

  return isOverlapping ? theme.BG : '#ffffff';
}

function createDateSprite(currentTime: Date, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;

  const value = formatDateLabel(currentTime);
  if (!drawTextSprite(canvas, value, color, '700 34px "Segoe UI", sans-serif')) {
    return null;
  }

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
  });

  const sprite = new Sprite(material);
  sprite.scale.set(0.7, 0.42, 1);
  sprite.position.set(0, 0.34, 0.05);
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

function createClockScene(scene: Scene, theme: ThemePalette, currentTime: Date) {
  const frame = new Mesh(
    new RingGeometry(0.91, 0.919, 96),
    new MeshStandardMaterial({ color: theme.PANEL, metalness: 0.22, roughness: 0.62 }),
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

  const dateSprite = createDateSprite(currentTime, getDateTextColor(theme, currentTime));

  const group = new Group();
  group.add(frame, face, markers, numbers, hourHand, minuteHand, secondHand);
  if (dateSprite) {
    group.add(dateSprite);
  }
  scene.add(group);

  return { hourHand, minuteHand, secondHand, dateSprite };
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
};

export function ThreeClockPreview({ currentTime, theme }: ThreeClockPreviewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hourHandRef = useRef<Group | null>(null);
  const minuteHandRef = useRef<Group | null>(null);
  const secondHandRef = useRef<Group | null>(null);
  const dateSpriteRef = useRef<Sprite | null>(null);

  useEffect(() => {
    const mountNode = mountRef.current;

    if (!mountNode) {
      return;
    }

    const scene = new Scene();
    scene.background = new Color(theme.BG);

    const camera = new PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0, 3.34);

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const light = new AmbientLight('#ffffff', 3.1);
    scene.add(light);

    const { hourHand, minuteHand, secondHand, dateSprite } = createClockScene(
      scene,
      theme,
      currentTime,
    );
    hourHandRef.current = hourHand;
    minuteHandRef.current = minuteHand;
    secondHandRef.current = secondHand;
    dateSpriteRef.current = dateSprite ?? null;
    updateClockHands(hourHand, minuteHand, secondHand, currentTime);

    const resize = () => {
      const size = new Vector2(mountNode.clientWidth, mountNode.clientHeight);
      renderer.setSize(size.x, size.y);
      camera.aspect = size.x / size.y;
      camera.updateProjectionMatrix();
    };

    resize();
    mountNode.appendChild(renderer.domElement);

    let frameId = 0;

    const animate = () => {
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(frameId);
      mountNode.removeChild(renderer.domElement);
      renderer.dispose();
      scene.clear();
      hourHandRef.current = null;
      minuteHandRef.current = null;
      secondHandRef.current = null;
      dateSpriteRef.current = null;
    };
  }, [theme]);

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
      '700 34px "Segoe UI", sans-serif',
    );
    material.map.needsUpdate = true;
  }, [currentTime]);

  return <div className="three-preview" ref={mountRef} />;
}
