import bbox from '@turf/bbox';
import bboxClip from '@turf/bbox-clip';
import centroid from '@turf/centroid';
import difference from '@turf/difference';
import { polygon } from '@turf/helpers';
import pointOnFeature from '@turf/point-on-feature';
import pointsWithinPolygon from '@turf/points-within-polygon';
import { randomPoint } from '@turf/random';
import truncate from '@turf/truncate';
import union from '@turf/union';

import Logger from '~/services/logger';

const logger = Logger.get('Math');

const truncateOptions = { precision: 2 };

const catchAndLogError =
  (callFunction) =>
  (...args) => {
    try {
      return callFunction(...args);
    } catch (error) {
      // eslint-disable-next-line no-console
      logger.debug(`[${callFunction.name}] Error catched for args`, ...args);
      throw error;
    }
  };

// Helpers
export const getPointCoords = catchAndLogError((p) => {
  const [x, y] = p.geometry.coordinates;
  return { x, y };
});

// Geometry
export const getCentroid = catchAndLogError((poly) => getPointCoords(centroid(poly)));

export const transformRectToPolygonPoints = (rect, extraSize = 0) => {
  const left = Math.max((rect.x ?? rect.left) - extraSize, 0);
  const top = Math.max((rect.y ?? rect.top) - extraSize, 0);
  const width = rect.width + 2 * extraSize;
  const height = rect.height + 2 * extraSize;
  const right = left + width;
  const bottom = top + height;

  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
    [left, top],
  ];
};

export const transformRectToPolygon = catchAndLogError((rect, extraSize) => {
  const points = transformRectToPolygonPoints(rect, extraSize);
  return polygon([points]);
});

export const clipPolygonToBbox = catchAndLogError((poly, boundries) =>
  truncate(bboxClip(poly, boundries), truncateOptions),
);

export const combinePolygons = catchAndLogError((polygons = []) => {
  if (!polygons.length) {
    return null;
  }

  let combinedPolygons = polygons[0];

  for (let index = 1; index < polygons.length; index += 1) {
    combinedPolygons = union(combinedPolygons, polygons[index]);
  }

  return truncate(combinedPolygons, truncateOptions);
});

export const diffPolygons = catchAndLogError((polygon1, polygon2) => {
  const diff = catchAndLogError(difference)(polygon1, polygon2);

  if (!diff) {
    return transformRectToPolygon({ x: 0, y: 0, width: 0, height: 0 });
  }

  return truncate(diff, truncateOptions);
});

export const getPolygonPointsList = catchAndLogError((poly, pointsLimit = 100) => {
  const polygonBbox = bbox(poly);
  const isEmptyBbox = polygonBbox.some((number) => Number.isFinite(number));
  if (!isEmptyBbox) {
    return [];
  }

  const points = truncate(randomPoint(pointsLimit, { bbox: polygonBbox }), truncateOptions);
  const perfectPointOnFeature = getPointCoords(pointOnFeature(poly));
  return [perfectPointOnFeature].concat(
    truncate(pointsWithinPolygon(points, poly), truncateOptions).features.map(getPointCoords),
  );
});
