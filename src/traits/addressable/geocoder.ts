import type { AddressGeocode, GeocodePrecision } from '@/schemas/address-metadata.js';

export interface GoogleGeocodePayload {
  readonly location?: {
    readonly latitude?: number;
    readonly longitude?: number;
  };
  readonly placeId?: string;
  readonly locationType?: string;
  readonly plusCode?: {
    readonly globalCode?: string;
  };
}

const GOOGLE_PRECISION_MAP: Record<string, GeocodePrecision> = {
  ROOFTOP: 'rooftop',
  RANGE_INTERPOLATED: 'range_interpolated',
  GEOMETRIC_CENTER: 'geometric_center',
  APPROXIMATE: 'approximate',
};

export function resolveGooglePrecision(locationType?: string | null): GeocodePrecision {
  if (!locationType) {
    return 'approximate';
  }

  return GOOGLE_PRECISION_MAP[locationType.toUpperCase()] ?? 'approximate';
}

export function toAddressGeocodeFromGoogle(payload?: GoogleGeocodePayload | null): AddressGeocode | undefined {
  if (!payload?.location) {
    return undefined;
  }

  const { latitude, longitude } = payload.location;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return undefined;
  }

  return {
    latitude,
    longitude,
    precision: resolveGooglePrecision(payload.locationType),
    source: payload.placeId ?? payload.plusCode?.globalCode ?? 'google-av',
  };
}
