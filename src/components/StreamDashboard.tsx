import React, { useEffect, useMemo, useRef, useState } from 'react';
import './StreamDashboard.css';
import StreamCard from './StreamCard';

import type { Stream, StreamQuality, ViewLayoutMode } from '../types';

interface StreamDashboardProps {
    layoutMode: ViewLayoutMode;
    streams: Stream[];
    streamQuality: StreamQuality;
    onRemoveStream: (id: string, platform: Stream['platform']) => void;
}

type GridBounds = {
    height: number;
    width: number;
};

type GridCandidate = {
    area: number;
    cols: number;
    rows: number;
    tileHeight: number;
    tileWidth: number;
    totalHeight: number;
    totalWidth: number;
};

const VIDEO_ASPECT = 16 / 9;
const GRID_GAP = 8;
const VIABLE_AREA_RATIO = 0.52;

const byArea = (a: GridCandidate, b: GridCandidate) => b.area - a.area;

const createFitCandidate = (count: number, cols: number, width: number, height: number): GridCandidate | null => {
    const rows = Math.ceil(count / cols);
    const cellWidth = (width - GRID_GAP * (cols - 1)) / cols;
    const cellHeight = (height - GRID_GAP * (rows - 1)) / rows;

    if (cellWidth <= 0 || cellHeight <= 0) return null;

    const tileWidth = Math.floor(Math.min(cellWidth, cellHeight * VIDEO_ASPECT));
    const tileHeight = Math.floor(tileWidth / VIDEO_ASPECT);

    if (tileWidth <= 0 || tileHeight <= 0) return null;

    return {
        area: tileWidth * tileHeight,
        cols,
        rows,
        tileHeight,
        tileWidth,
        totalHeight: tileHeight * rows + GRID_GAP * (rows - 1),
        totalWidth: tileWidth * cols + GRID_GAP * (cols - 1),
    };
};

const createWidthGuidedCandidate = (count: number, cols: number, width: number, height: number): GridCandidate | null => {
    const rows = Math.ceil(count / cols);
    const tileWidth = Math.floor((width - GRID_GAP * (cols - 1)) / cols);
    const tileHeight = Math.floor(tileWidth / VIDEO_ASPECT);
    const totalHeight = tileHeight * rows + GRID_GAP * (rows - 1);

    if (tileWidth <= 0 || tileHeight <= 0 || totalHeight > height) return null;

    return {
        area: tileWidth * tileHeight,
        cols,
        rows,
        tileHeight,
        tileWidth,
        totalHeight,
        totalWidth: width,
    };
};

const createHeightGuidedCandidate = (count: number, rows: number, width: number, height: number): GridCandidate | null => {
    const cols = Math.ceil(count / rows);
    const tileHeight = Math.floor((height - GRID_GAP * (rows - 1)) / rows);
    const tileWidth = Math.floor(tileHeight * VIDEO_ASPECT);
    const totalWidth = tileWidth * cols + GRID_GAP * (cols - 1);

    if (tileWidth <= 0 || tileHeight <= 0 || totalWidth > width) return null;

    return {
        area: tileWidth * tileHeight,
        cols,
        rows,
        tileHeight,
        tileWidth,
        totalHeight: height,
        totalWidth,
    };
};

const getFallbackLayout = (count: number): GridCandidate => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count || 1)));
    const rows = Math.max(1, Math.ceil((count || 1) / cols));

    return {
        area: 0,
        cols,
        rows,
        tileHeight: 180,
        tileWidth: 320,
        totalHeight: 180 * rows + GRID_GAP * (rows - 1),
        totalWidth: 320 * cols + GRID_GAP * (cols - 1),
    };
};

const computeLayout = (count: number, bounds: GridBounds, mode: ViewLayoutMode): GridCandidate => {
    if (count <= 0 || bounds.width <= 0 || bounds.height <= 0) return getFallbackLayout(count);

    const fitCandidates = Array.from({ length: count }, (_, index) => index + 1)
        .map((cols) => createFitCandidate(count, cols, bounds.width, bounds.height))
        .filter((candidate): candidate is GridCandidate => Boolean(candidate))
        .sort(byArea);

    const best = fitCandidates[0] || getFallbackLayout(count);

    if (mode === 'width-guided') {
        const widthCandidate = Array.from({ length: count }, (_, index) => index + 1)
            .map((cols) => createWidthGuidedCandidate(count, cols, bounds.width, bounds.height))
            .filter((candidate): candidate is GridCandidate => Boolean(candidate))
            .sort(byArea)[0];

        return widthCandidate || best;
    }

    if (mode === 'height-guided') {
        const heightCandidate = Array.from({ length: count }, (_, index) => index + 1)
            .map((rows) => createHeightGuidedCandidate(count, rows, bounds.width, bounds.height))
            .filter((candidate): candidate is GridCandidate => Boolean(candidate))
            .sort(byArea)[0];

        return heightCandidate || best;
    }

    const viable = fitCandidates.filter((candidate) => candidate.area >= best.area * VIABLE_AREA_RATIO);

    if (mode === 'max-horizontal') {
        return [...viable].sort((a, b) => b.cols - a.cols || b.area - a.area)[0] || best;
    }

    if (mode === 'max-vertical') {
        return [...viable].sort((a, b) => b.rows - a.rows || b.area - a.area)[0] || best;
    }

    return [...fitCandidates].sort((a, b) => b.area - a.area || Math.abs(a.cols - a.rows) - Math.abs(b.cols - b.rows))[0] || best;
};

const StreamDashboard: React.FC<StreamDashboardProps> = ({ streams, layoutMode, streamQuality, onRemoveStream }) => {
    const dashboardRef = useRef<HTMLElement | null>(null);
    const [bounds, setBounds] = useState<GridBounds>({ height: 0, width: 0 });

    useEffect(() => {
        const element = dashboardRef.current;
        if (!element) return;

        const updateBounds = () => {
            const rect = element.getBoundingClientRect();
            setBounds({
                height: Math.max(0, rect.height - GRID_GAP * 2),
                width: Math.max(0, rect.width - GRID_GAP * 2),
            });
        };

        updateBounds();

        const observer = new ResizeObserver(updateBounds);
        observer.observe(element);
        window.addEventListener('resize', updateBounds);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateBounds);
        };
    }, []);

    const layout = useMemo(
        () => computeLayout(streams.length, bounds, layoutMode),
        [bounds, layoutMode, streams.length]
    );

    const gridStyle = streams.length > 0
        ? {
            gap: `${GRID_GAP}px`,
            gridTemplateColumns: `repeat(${layout.cols}, ${layout.tileWidth}px)`,
            gridTemplateRows: `repeat(${layout.rows}, ${layout.tileHeight}px)`,
        }
        : undefined;

    return (
        <section
            className={streams.length === 0 ? 'stream-grid stream-grid--empty' : 'stream-grid'}
            data-layout-mode={layoutMode}
            ref={dashboardRef}
            style={gridStyle}
        >
            {streams.length === 0 ? (
                <div className="empty-state">
                    <h2>Nenhuma stream ativa</h2>
                    <p>Adicione um canal para abrir a tela Watch.</p>
                </div>
            ) : (
                streams.map((stream) => (
                    <StreamCard
                        key={`${stream.platform}-${stream.id}`}
                        streamId={stream.id}
                        platform={stream.platform}
                        title={stream.title}
                        streamQuality={streamQuality}
                        onRemove={() => onRemoveStream(stream.id, stream.platform)}
                    />
                ))
            )}
        </section>
    );
};

export default StreamDashboard;
