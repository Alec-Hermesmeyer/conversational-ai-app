'use client';

import React, { useEffect, useRef } from 'react';

interface VoiceOrbProps {
	level?: number; // 0..1
	listening?: boolean;
	className?: string;
	size?: number; // px
}

// A lightweight circular visualizer inspired by game UIs
export default function VoiceOrb({ level = 0, listening = false, className = '', size = 280 }: VoiceOrbProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const animRef = useRef<number | null>(null);
	const lastLevelRef = useRef<number>(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let raf: number;
		const render = () => {
			const width = canvas.width;
			const height = canvas.height;
			ctx.clearRect(0, 0, width, height);

			const centerX = width / 2;
			const centerY = height / 2;
			const baseRadius = Math.min(width, height) / 2 - 8;

			// Smooth the input level for nicer motion
			const smoothed = lastLevelRef.current + (level - lastLevelRef.current) * 0.15;
			lastLevelRef.current = smoothed;

			// Glow ring
			const glow = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.6, centerX, centerY, baseRadius * 1.15);
			glow.addColorStop(0, 'rgba(59,130,246,0.15)');
			glow.addColorStop(1, 'rgba(16,185,129,0.05)');
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(centerX, centerY, baseRadius * 1.1, 0, Math.PI * 2);
			ctx.fill();

			// Outer tick ring inspired by HUDs
			ctx.save();
			ctx.translate(centerX, centerY);
			const segments = 64;
			for (let i = 0; i < segments; i++) {
				const p = i / segments;
				const angle = p * Math.PI * 2;
				const intensity = listening ? 0.5 + 0.5 * Math.sin(performance.now() / 900 + i * 0.2) : 0.25;
				ctx.strokeStyle = `rgba(99,102,241,${0.15 + intensity * 0.25})`;
				ctx.lineWidth = 2;
				ctx.beginPath();
				const r1 = baseRadius + 2;
				const r2 = r1 + (i % 4 === 0 ? 8 : 5);
				ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
				ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
				ctx.stroke();
			}
			ctx.restore();

			// Reactive inner circle
			const reactiveRadius = baseRadius * (0.75 + smoothed * 0.22);
			const gradient = ctx.createLinearGradient(0, centerY - reactiveRadius, 0, centerY + reactiveRadius);
			gradient.addColorStop(0, '#3b82f6'); // blue-500
			gradient.addColorStop(1, '#10b981'); // emerald-500
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(centerX, centerY, reactiveRadius, 0, Math.PI * 2);
			ctx.fill();

			// Masked waveform-like spokes
			ctx.save();
			ctx.globalCompositeOperation = 'destination-out';
			const spokes = 42;
			for (let i = 0; i < spokes; i++) {
				const ratio = i / spokes;
				const ang = ratio * Math.PI * 2 + performance.now() / 1500;
				const len = (0.12 + 0.55 * smoothed) * reactiveRadius;
				ctx.beginPath();
				ctx.moveTo(centerX + Math.cos(ang) * (reactiveRadius - len), centerY + Math.sin(ang) * (reactiveRadius - len));
				ctx.lineTo(centerX + Math.cos(ang) * (reactiveRadius + len * 0.15), centerY + Math.sin(ang) * (reactiveRadius + len * 0.15));
				ctx.strokeStyle = 'rgba(255,255,255,0.08)';
				ctx.lineWidth = 4;
				ctx.stroke();
			}
			ctx.restore();

			// Center dot
			ctx.fillStyle = 'rgba(255,255,255,0.9)';
			ctx.beginPath();
			ctx.arc(centerX, centerY, 4 + smoothed * 3, 0, Math.PI * 2);
			ctx.fill();

			raf = requestAnimationFrame(render);
		};

		render();
		animRef.current = raf;
		return () => {
			if (animRef.current) cancelAnimationFrame(animRef.current);
		};
	}, [level, listening]);

	return (
		<div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
			<div className="absolute inset-0 rounded-full bg-gradient-to-b from-gray-900 to-gray-800 dark:from-gray-900 dark:to-black border border-gray-700/50 shadow-2xl" />
			<canvas ref={canvasRef} width={size} height={size} className="relative z-10 rounded-full" />
			{/* Status badge */}
			<div className="absolute bottom-4 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white backdrop-blur border border-white/20">
				{listening ? 'Listening' : 'Idle'}
			</div>
		</div>
	);
}


