"use client";

import { useEffect, useRef } from "react";

export type OddsFlowPoint = {
  close: number;
  high?: number;
  low?: number;
  open?: number;
  timestamp: string;
  volume?: number | null;
};

export type OddsFlowHitTarget = {
  index: number;
  plotBottom: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  point: OddsFlowPoint;
  x: number;
  y: number;
};

type OddsFlowChartProps = {
  className?: string;
  emptyMessage?: string;
  hoveredIndex?: number | null;
  label?: string;
  onTargetsChange?: (targets: OddsFlowHitTarget[]) => void;
  points: OddsFlowPoint[];
  tone?: "dark" | "light";
};

type ChartTheme = {
  areaBottom: string;
  areaTop: string;
  axis: string;
  background: string;
  crosshair: string;
  grid: string;
  label: string;
  line: string;
  muted: string;
  priceLine: string;
  text: string;
};

const darkTheme: ChartTheme = {
  areaBottom: "rgba(249, 115, 22, 0.015)",
  areaTop: "rgba(249, 115, 22, 0.24)",
  axis: "rgba(204, 195, 216, 0.18)",
  background: "#050505",
  crosshair: "rgba(249, 115, 22, 0.48)",
  grid: "rgba(255, 255, 255, 0.036)",
  label: "rgba(249, 115, 22, 0.9)",
  line: "#f97316",
  muted: "rgba(204, 195, 216, 0.58)",
  priceLine: "rgba(249, 115, 22, 0.56)",
  text: "rgba(204, 195, 216, 0.68)",
};

const lightTheme: ChartTheme = {
  areaBottom: "rgba(249, 115, 22, 0.02)",
  areaTop: "rgba(249, 115, 22, 0.16)",
  axis: "rgba(17, 22, 20, 0.15)",
  background: "#fffefa",
  crosshair: "rgba(154, 103, 22, 0.48)",
  grid: "rgba(17, 22, 20, 0.06)",
  label: "#9a6716",
  line: "#9a6716",
  muted: "rgba(17, 22, 20, 0.54)",
  priceLine: "rgba(154, 103, 22, 0.5)",
  text: "rgba(17, 22, 20, 0.58)",
};

export function OddsFlowChart({
  className,
  emptyMessage = "Awaiting market price history",
  hoveredIndex = null,
  label = "CONVICTION YES FLOW",
  onTargetsChange,
  points,
  tone = "dark",
}: OddsFlowChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const draw = () => {
      const targets = drawOddsFlowChart(canvasRef.current, points, {
        emptyMessage,
        hoveredIndex,
        label,
        theme: tone === "light" ? lightTheme : darkTheme,
      });

      onTargetsChange?.(targets);
    };

    draw();
    window.addEventListener("resize", draw);

    return () => window.removeEventListener("resize", draw);
  }, [emptyMessage, hoveredIndex, label, onTargetsChange, points, tone]);

  return <canvas ref={canvasRef} className={className} />;
}

function drawOddsFlowChart(
  canvas: HTMLCanvasElement | null,
  rawPoints: OddsFlowPoint[],
  options: {
    emptyMessage: string;
    hoveredIndex: number | null;
    label: string;
    theme: ChartTheme;
  },
): OddsFlowHitTarget[] {
  if (!canvas) return [];

  const parent = canvas.parentElement;
  const width = Math.max(320, parent?.clientWidth ?? 760);
  const height = Math.max(240, parent?.clientHeight ?? 420);
  const pixelRatio = window.devicePixelRatio || 1;
  const context = canvas.getContext("2d");

  if (!context) return [];

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  drawChartBackground(context, width, height, options.theme);

  const points = getReadablePoints(rawPoints, width);

  if (points.length === 0) {
    drawChartEmptyState(context, width, height, options.emptyMessage, options.theme);
    return [];
  }

  const plot = {
    left: width >= 900 ? 48 : 42,
    right: width >= 900 ? 56 : 46,
    top: height >= 520 ? 26 : 24,
    bottom: height >= 520 ? 48 : 42,
  };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const values = points.flatMap((point) => [
    point.close,
    point.open ?? point.close,
    point.high ?? point.close,
    point.low ?? point.close,
  ]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max(1.5, (rawMax - rawMin) * 0.2);
  const min = Math.max(0, rawMin - padding);
  const max = Math.min(100, rawMax + padding);
  const range = Math.max(1, max - min);
  const yFor = (value: number) => plot.top + ((max - value) / range) * plotHeight;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const targets: OddsFlowHitTarget[] = points.map((point, index) => {
    const x = points.length > 1 ? plot.left + xStep * index : plot.left + plotWidth / 2;
    const y = yFor(point.close);

    return {
      index,
      plotBottom: height - plot.bottom,
      plotLeft: plot.left,
      plotRight: width - plot.right,
      plotTop: plot.top,
      point,
      x,
      y,
    };
  });

  drawChartAxis(context, width, height, plot, min, max, options.theme);
  drawOddsArea(context, targets, height - plot.bottom, options.theme);
  drawOddsLine(context, targets, options.theme);
  drawEndpointDots(context, targets, options.theme);

  const hoveredTarget = targets.find((target) => target.index === options.hoveredIndex);

  if (hoveredTarget) {
    drawCrosshair(context, hoveredTarget, height, plot, options.theme);
  }

  const lastTarget = targets[targets.length - 1];
  drawLastPriceLine(context, lastTarget, width, plot, options.theme);

  context.fillStyle = options.theme.muted;
  context.font = "800 10px JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(options.label, plot.left, height - 16);

  return targets;
}

function drawChartBackground(context: CanvasRenderingContext2D, width: number, height: number, theme: ChartTheme) {
  context.fillStyle = theme.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = theme.grid;
  context.lineWidth = 1;

  for (let x = 0; x < width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y < height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawChartAxis(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  plot: { left: number; right: number; top: number; bottom: number },
  min: number,
  max: number,
  theme: ChartTheme,
) {
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;

  context.strokeStyle = theme.axis;
  context.lineWidth = 1;
  context.strokeRect(plot.left, plot.top, plotWidth, plotHeight);
  context.font = "800 9px JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace";

  [max, max - (max - min) * 0.25, (max + min) / 2, min + (max - min) * 0.25, min].forEach((value) => {
    const y = plot.top + ((max - value) / Math.max(1, max - min)) * plotHeight;

    context.strokeStyle = theme.grid;
    context.beginPath();
    context.moveTo(plot.left, y);
    context.lineTo(width - plot.right, y);
    context.stroke();

    context.fillStyle = theme.text;
    context.fillText(formatPercent(value), 8, Math.max(plot.top + 10, Math.min(height - plot.bottom - 4, y + 3)));
  });
}

function drawOddsArea(
  context: CanvasRenderingContext2D,
  targets: OddsFlowHitTarget[],
  baseline: number,
  theme: ChartTheme,
) {
  if (targets.length === 0) return;

  const gradient = context.createLinearGradient(0, targets[0].plotTop, 0, baseline);
  gradient.addColorStop(0, theme.areaTop);
  gradient.addColorStop(1, theme.areaBottom);

  context.beginPath();
  context.moveTo(targets[0].x, baseline);
  targets.forEach((target) => context.lineTo(target.x, target.y));
  context.lineTo(targets[targets.length - 1].x, baseline);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();
}

function drawOddsLine(context: CanvasRenderingContext2D, targets: OddsFlowHitTarget[], theme: ChartTheme) {
  if (targets.length === 0) return;

  context.beginPath();
  targets.forEach((target, index) => {
    if (index === 0) {
      context.moveTo(target.x, target.y);
    } else {
      const previous = targets[index - 1];
      const midpoint = (previous.x + target.x) / 2;
      context.bezierCurveTo(midpoint, previous.y, midpoint, target.y, target.x, target.y);
    }
  });
  context.strokeStyle = theme.line;
  context.lineWidth = 2.4;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();
}

function drawEndpointDots(context: CanvasRenderingContext2D, targets: OddsFlowHitTarget[], theme: ChartTheme) {
  if (targets.length === 0) return;

  const first = targets[0];
  const last = targets[targets.length - 1];

  [first, last].forEach((target) => {
    context.beginPath();
    context.arc(target.x, target.y, 3.3, 0, Math.PI * 2);
    context.fillStyle = theme.background;
    context.fill();
    context.strokeStyle = theme.line;
    context.lineWidth = 2;
    context.stroke();
  });
}

function drawCrosshair(
  context: CanvasRenderingContext2D,
  target: OddsFlowHitTarget,
  height: number,
  plot: { left: number; right: number; top: number; bottom: number },
  theme: ChartTheme,
) {
  context.fillStyle = "rgba(249, 115, 22, 0.055)";
  context.fillRect(Math.max(plot.left, target.x - 18), plot.top, 36, height - plot.top - plot.bottom);
  context.strokeStyle = theme.crosshair;
  context.setLineDash([4, 5]);
  context.beginPath();
  context.moveTo(target.x, plot.top);
  context.lineTo(target.x, height - plot.bottom);
  context.stroke();
  context.beginPath();
  context.moveTo(plot.left, target.y);
  context.lineTo(target.plotRight, target.y);
  context.stroke();
  context.setLineDash([]);

  context.beginPath();
  context.arc(target.x, target.y, 4.8, 0, Math.PI * 2);
  context.fillStyle = theme.background;
  context.fill();
  context.strokeStyle = theme.line;
  context.lineWidth = 2.2;
  context.stroke();
}

function drawLastPriceLine(
  context: CanvasRenderingContext2D,
  target: OddsFlowHitTarget,
  width: number,
  plot: { left: number; right: number; top: number; bottom: number },
  theme: ChartTheme,
) {
  context.strokeStyle = theme.priceLine;
  context.lineWidth = 1;
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(plot.left, target.y);
  context.lineTo(width - plot.right, target.y);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = theme.label;
  context.font = "800 11px JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "right";
  context.fillText(formatPercent(target.point.close), width - 10, Math.max(18, Math.min(target.plotBottom - 8, target.y - 6)));
  context.textAlign = "start";
}

function drawChartEmptyState(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  message: string,
  theme: ChartTheme,
) {
  context.fillStyle = theme.text;
  context.font = "800 11px JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = "center";
  context.fillText(message, width / 2, height / 2);
  context.textAlign = "start";
}

function getReadablePoints(points: OddsFlowPoint[], width: number) {
  const maxPoints = Math.max(60, Math.floor(width / 5));

  if (points.length <= maxPoints) return points;

  return points.slice(points.length - maxPoints);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(1) + "%";
}
