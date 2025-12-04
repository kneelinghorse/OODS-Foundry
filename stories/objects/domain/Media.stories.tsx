/**
 * Media Object — File/Asset Management Demo
 *
 * Media represents files and assets with trait composition:
 * - Labelled: Filename, alt text, description
 * - Ownerable: Uploader attribution and ownership
 * - Timestampable: Upload, modified timestamps
 * - Classifiable: Type categorization, tags
 *
 * Stories:
 * 1. Overview - What is a Media object?
 * 2. Media Gallery - Grid and list views with filtering
 * 3. Media Detail - Full metadata and usage information
 * 4. Upload Flow - File upload and processing demonstration
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/* ─────────────────────────────────────────────────────────────────────────────
 * Style constants
 * ───────────────────────────────────────────────────────────────────────────── */

const STYLES = {
  page: {
    padding: '2rem',
    maxWidth: '1100px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  heading: {
    marginTop: 0,
    marginBottom: '0.5rem',
  },
  subheading: {
    color: '#666',
    marginTop: 0,
    marginBottom: '2rem',
    fontWeight: 400 as const,
  },
  section: {
    marginBottom: '3rem',
  },
  groupLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: '#888',
    marginBottom: '0.75rem',
    fontWeight: 600 as const,
  },
  card: {
    padding: '1.5rem',
    borderRadius: '0.75rem',
    border: '1px solid #e0e0e0',
    background: '#fafafa',
  },
  codeBlock: {
    padding: '1rem',
    borderRadius: '0.5rem',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    overflow: 'auto' as const,
  },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Type definitions
 * ───────────────────────────────────────────────────────────────────────────── */

type MediaType = 'image' | 'video' | 'document' | 'audio';
type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

interface MediaOwner {
  id: string;
  name: string;
  avatar?: string;
}

interface MediaUsage {
  object_type: string;
  object_id: string;
  object_name: string;
  used_at: string;
}

interface Media {
  id: string;
  filename: string;
  alt_text?: string;
  description?: string;
  type: MediaType;
  mime_type: string;
  size_bytes: number;
  dimensions?: { width: number; height: number };
  duration_seconds?: number;
  processing_status: ProcessingStatus;
  owner: MediaOwner;
  tags: string[];
  usages: MediaUsage[];
  url: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sample Data
 * ───────────────────────────────────────────────────────────────────────────── */

const SAMPLE_MEDIA: Media[] = [
  {
    id: 'med_001',
    filename: 'hero-banner.jpg',
    alt_text: 'Product hero banner with blue gradient',
    description: 'Main hero banner for the homepage',
    type: 'image',
    mime_type: 'image/jpeg',
    size_bytes: 245760,
    dimensions: { width: 1920, height: 1080 },
    processing_status: 'ready',
    owner: { id: 'user_jane', name: 'Jane Cooper' },
    tags: ['hero', 'banner', 'homepage'],
    usages: [
      { object_type: 'Page', object_id: 'page_home', object_name: 'Homepage', used_at: '2024-12-01T10:00:00Z' },
      { object_type: 'Campaign', object_id: 'camp_winter', object_name: 'Winter Sale', used_at: '2024-12-05T14:30:00Z' },
    ],
    url: '/images/hero-banner.jpg',
    thumbnail_url: '/images/hero-banner-thumb.jpg',
    created_at: '2024-11-15T09:00:00Z',
    updated_at: '2024-12-05T14:30:00Z',
  },
  {
    id: 'med_002',
    filename: 'product-demo.mp4',
    alt_text: 'Product demonstration video',
    type: 'video',
    mime_type: 'video/mp4',
    size_bytes: 15728640,
    dimensions: { width: 1280, height: 720 },
    duration_seconds: 120,
    processing_status: 'ready',
    owner: { id: 'user_bob', name: 'Bob Wilson' },
    tags: ['video', 'demo', 'product'],
    usages: [
      { object_type: 'Article', object_id: 'art_getting_started', object_name: 'Getting Started Guide', used_at: '2024-12-10T11:00:00Z' },
    ],
    url: '/videos/product-demo.mp4',
    thumbnail_url: '/videos/product-demo-thumb.jpg',
    created_at: '2024-12-01T15:00:00Z',
    updated_at: '2024-12-01T15:00:00Z',
  },
  {
    id: 'med_003',
    filename: 'annual-report-2024.pdf',
    alt_text: 'Annual Report 2024',
    description: 'Company annual financial report for fiscal year 2024',
    type: 'document',
    mime_type: 'application/pdf',
    size_bytes: 3145728,
    processing_status: 'ready',
    owner: { id: 'user_alice', name: 'Alice Johnson' },
    tags: ['report', 'finance', '2024'],
    usages: [],
    url: '/documents/annual-report-2024.pdf',
    created_at: '2024-12-10T08:00:00Z',
    updated_at: '2024-12-10T08:00:00Z',
  },
  {
    id: 'med_004',
    filename: 'podcast-episode-42.mp3',
    alt_text: 'Podcast Episode 42 - Future of Tech',
    type: 'audio',
    mime_type: 'audio/mpeg',
    size_bytes: 52428800,
    duration_seconds: 2700,
    processing_status: 'ready',
    owner: { id: 'user_jane', name: 'Jane Cooper' },
    tags: ['podcast', 'audio', 'episode-42'],
    usages: [
      { object_type: 'Podcast', object_id: 'pod_techtalks', object_name: 'Tech Talks', used_at: '2024-12-08T12:00:00Z' },
    ],
    url: '/audio/podcast-episode-42.mp3',
    created_at: '2024-12-08T10:00:00Z',
    updated_at: '2024-12-08T12:00:00Z',
  },
  {
    id: 'med_005',
    filename: 'team-photo.png',
    alt_text: 'Team photo 2024',
    type: 'image',
    mime_type: 'image/png',
    size_bytes: 1048576,
    dimensions: { width: 2400, height: 1600 },
    processing_status: 'processing',
    owner: { id: 'user_bob', name: 'Bob Wilson' },
    tags: ['team', 'photo', '2024'],
    usages: [],
    url: '/images/team-photo.png',
    created_at: '2024-12-12T16:00:00Z',
    updated_at: '2024-12-12T16:00:00Z',
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * Helper Functions
 * ───────────────────────────────────────────────────────────────────────────── */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Badge Components
 * ───────────────────────────────────────────────────────────────────────────── */

function MediaTypeBadge({ type }: { type: MediaType }): JSX.Element {
  const configs: Record<MediaType, { bg: string; color: string; icon: string }> = {
    image: { bg: '#dbeafe', color: '#1e40af', icon: '[img]' },
    video: { bg: '#fce7f3', color: '#9d174d', icon: '[vid]' },
    document: { bg: '#fef3c7', color: '#92400e', icon: '[doc]' },
    audio: { bg: '#dcfce7', color: '#166534', icon: '[aud]' },
  };
  const config = configs[type];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.25rem 0.5rem',
      borderRadius: '0.25rem',
      fontSize: '0.6875rem',
      fontWeight: 600,
      background: config.bg,
      color: config.color,
      textTransform: 'uppercase',
    }}>
      <span>{config.icon}</span>
      {type}
    </span>
  );
}

function ProcessingStatusBadge({ status }: { status: ProcessingStatus }): JSX.Element {
  const configs: Record<ProcessingStatus, { bg: string; color: string; icon: string }> = {
    pending: { bg: '#f3f4f6', color: '#6b7280', icon: 'o' },
    processing: { bg: '#dbeafe', color: '#1e40af', icon: '~' },
    ready: { bg: '#dcfce7', color: '#166534', icon: '+' },
    failed: { bg: '#fef2f2', color: '#dc2626', icon: '!' },
  };
  const config = configs[status];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.25rem 0.5rem',
      borderRadius: '9999px',
      fontSize: '0.6875rem',
      fontWeight: 600,
      background: config.bg,
      color: config.color,
    }}>
      <span>{config.icon}</span>
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is a Media object?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Media</h1>
      <h2 style={STYLES.subheading}>
        File and asset management with metadata and usage tracking
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          A <strong>Media</strong> object represents any file or asset in the system - images,
          videos, documents, or audio files. It tracks metadata, ownership, processing status,
          and where the asset is used across the application.
        </p>

        {/* Composed Traits */}
        <div style={STYLES.groupLabel}>Composed Traits</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#7c3aed' }}>Labelled</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>filename, alt_text, description</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#dc2626' }}>Ownerable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>uploader attribution</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#0891b2' }}>Timestampable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>created_at, updated_at</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#f59e0b' }}>Classifiable</strong>
            <span style={{ color: '#666', fontSize: '0.875rem' }}>type, mime_type, tags</span>
          </div>
        </div>
      </section>

      {/* Media Types */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Supported Media Types</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <MediaTypeBadge type="image" />
          <MediaTypeBadge type="video" />
          <MediaTypeBadge type="document" />
          <MediaTypeBadge type="audio" />
        </div>
      </section>

      {/* Processing States */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Processing States</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <ProcessingStatusBadge status="pending" />
          <ProcessingStatusBadge status="processing" />
          <ProcessingStatusBadge status="ready" />
          <ProcessingStatusBadge status="failed" />
        </div>
      </section>

      {/* Schema Preview */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Schema Structure</div>
        <pre style={STYLES.codeBlock}>
{`{
  // Identity
  id: "med_001",

  // Labelled trait
  filename: "hero-banner.jpg",
  alt_text: "Product hero banner with blue gradient",
  description: "Main hero banner for the homepage",

  // Classifiable trait
  type: "image",
  mime_type: "image/jpeg",
  tags: ["hero", "banner", "homepage"],

  // File metadata
  size_bytes: 245760,
  dimensions: { width: 1920, height: 1080 },
  processing_status: "ready",

  // Ownerable trait
  owner: { id: "user_jane", name: "Jane Cooper" },

  // Usage tracking
  usages: [
    { object_type: "Page", object_name: "Homepage", ... }
  ],

  // Timestampable trait
  created_at: "2024-11-15T09:00:00Z",
  updated_at: "2024-12-05T14:30:00Z"
}`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. MEDIA GALLERY — Grid and list views
 * ───────────────────────────────────────────────────────────────────────────── */

function MediaGridItem({ media }: { media: Media }): JSX.Element {
  const getPlaceholderBg = (type: MediaType): string => {
    const colors: Record<MediaType, string> = {
      image: '#3b82f6',
      video: '#ec4899',
      document: '#f59e0b',
      audio: '#10b981',
    };
    return colors[type];
  };

  const getPlaceholderIcon = (type: MediaType): string => {
    const icons: Record<MediaType, string> = {
      image: '[IMG]',
      video: '[VID]',
      document: '[DOC]',
      audio: '[AUD]',
    };
    return icons[type];
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '0.75rem',
      overflow: 'hidden',
      cursor: 'pointer',
    }}>
      {/* Thumbnail */}
      <div style={{
        height: '140px',
        background: `linear-gradient(135deg, ${getPlaceholderBg(media.type)}40, ${getPlaceholderBg(media.type)}15)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{ fontSize: '2rem', color: getPlaceholderBg(media.type) }}>
          {getPlaceholderIcon(media.type)}
        </span>
        {media.processing_status === 'processing' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.875rem',
          }}>
            Processing...
          </div>
        )}
        {media.duration_seconds && (
          <div style={{
            position: 'absolute',
            bottom: '0.5rem',
            right: '0.5rem',
            padding: '0.125rem 0.375rem',
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            borderRadius: '0.25rem',
            fontSize: '0.6875rem',
            fontWeight: 500,
          }}>
            {formatDuration(media.duration_seconds)}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <MediaTypeBadge type={media.type} />
          <ProcessingStatusBadge status={media.processing_status} />
        </div>
        <div style={{
          fontWeight: 500,
          fontSize: '0.875rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '0.25rem',
        }}>
          {media.filename}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>
          {formatFileSize(media.size_bytes)}
          {media.dimensions && ` | ${media.dimensions.width}x${media.dimensions.height}`}
        </div>
      </div>
    </div>
  );
}

function MediaListItem({ media }: { media: Media }): JSX.Element {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '1rem',
      background: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '0.5rem',
    }}>
      {/* Icon */}
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '0.5rem',
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <MediaTypeBadge type={media.type} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {media.filename}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
          {formatFileSize(media.size_bytes)} | {media.owner.name} | {formatDate(media.created_at)}
        </div>
      </div>

      {/* Status & Usages */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <ProcessingStatusBadge status={media.processing_status} />
        <div style={{
          padding: '0.25rem 0.5rem',
          background: '#f3f4f6',
          borderRadius: '0.25rem',
          fontSize: '0.75rem',
          color: '#666',
        }}>
          {media.usages.length} {media.usages.length === 1 ? 'use' : 'uses'}
        </div>
      </div>
    </div>
  );
}

function MediaGalleryStory(): JSX.Element {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [typeFilter, setTypeFilter] = useState<MediaType | null>(null);

  const filteredMedia = typeFilter
    ? SAMPLE_MEDIA.filter(m => m.type === typeFilter)
    : SAMPLE_MEDIA;

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Media Gallery</h1>
      <h2 style={STYLES.subheading}>
        Browse and filter media assets
      </h2>

      {/* Controls */}
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
      }}>
        {/* Type Filter */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setTypeFilter(null)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid',
              borderColor: !typeFilter ? '#3b82f6' : '#e5e7eb',
              background: !typeFilter ? '#eff6ff' : '#fff',
              color: !typeFilter ? '#3b82f6' : '#374151',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {(['image', 'video', 'document', 'audio'] as MediaType[]).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid',
                borderColor: typeFilter === type ? '#3b82f6' : '#e5e7eb',
                background: typeFilter === type ? '#eff6ff' : '#fff',
                color: typeFilter === type ? '#3b82f6' : '#374151',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {type}s
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '0.5rem', padding: '0.25rem' }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: viewMode === 'grid' ? '#fff' : 'transparent',
              boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
            }}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: viewMode === 'list' ? '#fff' : 'transparent',
              boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
            }}
          >
            List
          </button>
        </div>
      </section>

      {/* Gallery */}
      <section style={STYLES.section}>
        {viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {filteredMedia.map((media) => (
              <MediaGridItem key={media.id} media={media} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredMedia.map((media) => (
              <MediaListItem key={media.id} media={media} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. MEDIA DETAIL — Full metadata view
 * ───────────────────────────────────────────────────────────────────────────── */

function MediaDetailStory(): JSX.Element {
  const media = SAMPLE_MEDIA[0]; // Use the first image as example

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Media Detail</h1>
      <h2 style={STYLES.subheading}>
        Full metadata and usage information for a media asset
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
        {/* Preview */}
        <div>
          <div style={{
            background: `linear-gradient(135deg, #3b82f640, #3b82f615)`,
            borderRadius: '1rem',
            height: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}>
            <span style={{ fontSize: '4rem', color: '#3b82f6' }}>[IMG]</span>
          </div>

          {/* Usage */}
          <div style={STYLES.groupLabel}>Usage ({media.usages.length})</div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            {media.usages.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {media.usages.map((usage, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: '#f9fafb',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{usage.object_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>
                        {usage.object_type} | Added {formatDate(usage.used_at)}
                      </div>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      background: '#e5e7eb',
                      borderRadius: '0.25rem',
                      fontSize: '0.6875rem',
                      color: '#666',
                    }}>
                      View
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                This asset is not used anywhere yet
              </div>
            )}
          </div>
        </div>

        {/* Metadata Sidebar */}
        <div>
          <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <MediaTypeBadge type={media.type} />
              <ProcessingStatusBadge status={media.processing_status} />
            </div>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>{media.filename}</h2>
            {media.alt_text && (
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#666' }}>
                {media.alt_text}
              </p>
            )}
            {media.description && (
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#888' }}>
                {media.description}
              </p>
            )}
          </div>

          {/* File Info */}
          <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
            <div style={STYLES.groupLabel}>File Information</div>
            <table style={{ width: '100%', fontSize: '0.875rem' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#888' }}>Type</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>{media.mime_type}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.5rem 0', color: '#888' }}>Size</td>
                  <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>{formatFileSize(media.size_bytes)}</td>
                </tr>
                {media.dimensions && (
                  <tr>
                    <td style={{ padding: '0.5rem 0', color: '#888' }}>Dimensions</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                      {media.dimensions.width} x {media.dimensions.height}
                    </td>
                  </tr>
                )}
                {media.duration_seconds && (
                  <tr>
                    <td style={{ padding: '0.5rem 0', color: '#888' }}>Duration</td>
                    <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                      {formatDuration(media.duration_seconds)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Owner */}
          <div style={{ ...STYLES.card, background: '#fff', marginBottom: '1rem' }}>
            <div style={STYLES.groupLabel}>Uploaded By</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
              }}>
                {media.owner.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 500 }}>{media.owner.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>{formatDate(media.created_at)}</div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <div style={STYLES.groupLabel}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {media.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: '#f3f4f6',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#666',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. UPLOAD FLOW — File upload demonstration
 * ───────────────────────────────────────────────────────────────────────────── */

function UploadFlowStory(): JSX.Element {
  const [uploadStep, setUploadStep] = useState<'select' | 'uploading' | 'processing' | 'complete'>('select');
  const [progress, setProgress] = useState(0);

  const simulateUpload = () => {
    setUploadStep('uploading');
    setProgress(0);

    const uploadInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          setUploadStep('processing');

          setTimeout(() => {
            setUploadStep('complete');
          }, 2000);

          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const reset = () => {
    setUploadStep('select');
    setProgress(0);
  };

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Upload Flow</h1>
      <h2 style={STYLES.subheading}>
        File upload with progress and processing states
      </h2>

      <section style={STYLES.section}>
        <div style={{
          padding: '3rem',
          background: '#fff',
          border: '2px dashed #d1d5db',
          borderRadius: '1rem',
          textAlign: 'center',
        }}>
          {uploadStep === 'select' && (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#9ca3af' }}>
                [+]
              </div>
              <h3 style={{ margin: '0 0 0.5rem' }}>Drop files here or click to upload</h3>
              <p style={{ margin: '0 0 1.5rem', color: '#666' }}>
                Supports images, videos, documents, and audio files
              </p>
              <button
                onClick={simulateUpload}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Select Files
              </button>
            </>
          )}

          {uploadStep === 'uploading' && (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                [^]
              </div>
              <h3 style={{ margin: '0 0 0.5rem' }}>Uploading...</h3>
              <p style={{ margin: '0 0 1.5rem', color: '#666' }}>
                example-file.jpg
              </p>
              <div style={{
                width: '100%',
                maxWidth: '300px',
                height: '8px',
                background: '#e5e7eb',
                borderRadius: '4px',
                margin: '0 auto 1rem',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: '#3b82f6',
                  transition: 'width 0.2s ease',
                }} />
              </div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>{progress}%</div>
            </>
          )}

          {uploadStep === 'processing' && (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#3b82f6' }}>
                [~]
              </div>
              <h3 style={{ margin: '0 0 0.5rem' }}>Processing...</h3>
              <p style={{ margin: 0, color: '#666' }}>
                Generating thumbnails and extracting metadata
              </p>
            </>
          )}

          {uploadStep === 'complete' && (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#16a34a' }}>
                [+]
              </div>
              <h3 style={{ margin: '0 0 0.5rem', color: '#16a34a' }}>Upload Complete!</h3>
              <p style={{ margin: '0 0 1.5rem', color: '#666' }}>
                Your file is ready to use
              </p>
              <button
                onClick={reset}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Upload Another
              </button>
            </>
          )}
        </div>
      </section>

      {/* Processing Pipeline */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Processing Pipeline</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
        }}>
          {[
            { step: 1, label: 'Upload', description: 'File transfer to storage' },
            { step: 2, label: 'Validate', description: 'Type and size checks' },
            { step: 3, label: 'Process', description: 'Thumbnails & metadata' },
            { step: 4, label: 'Ready', description: 'Available for use' },
          ].map((item, index) => {
            const stepIndex = ['select', 'uploading', 'processing', 'complete'].indexOf(uploadStep);
            const isActive = index <= stepIndex;
            const isCurrent = index === stepIndex;

            return (
              <div
                key={item.step}
                style={{
                  padding: '1.25rem',
                  background: isCurrent ? '#eff6ff' : (isActive ? '#f9fafb' : '#fff'),
                  border: `1px solid ${isCurrent ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: '0.75rem',
                  textAlign: 'center',
                  opacity: isActive ? 1 : 0.5,
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isActive ? '#3b82f6' : '#e5e7eb',
                  color: isActive ? '#fff' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  margin: '0 auto 0.75rem',
                }}>
                  {item.step}
                </div>
                <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>{item.description}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Storybook Configuration
 * ───────────────────────────────────────────────────────────────────────────── */

type Story = StoryObj<Record<string, never>>;

const meta: Meta = {
  title: 'Objects/Domain Objects/Media',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

export const Overview: Story = {
  name: '1. Overview',
  render: () => <OverviewStory />,
};

export const MediaGallery: Story = {
  name: '2. Media Gallery',
  render: () => <MediaGalleryStory />,
};

export const MediaDetail: Story = {
  name: '3. Media Detail',
  render: () => <MediaDetailStory />,
};

export const UploadFlow: Story = {
  name: '4. Upload Flow',
  render: () => <UploadFlowStory />,
};
