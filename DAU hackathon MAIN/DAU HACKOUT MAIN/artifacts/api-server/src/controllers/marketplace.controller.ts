import type { Request, Response, NextFunction } from "express";
import {
  CreateListingBody,
  ListListingsQueryParams,
  ListListingsResponse,
} from "@workspace/api-zod";
import { marketplaceService } from "../services/marketplace.service";
import { AppError } from "../middleware/errors";

export async function listListings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = ListListingsQueryParams.parse(req.query);
    const minEnergy = req.query.minEnergy ? Number(req.query.minEnergy) : undefined;
    const maxEnergy = req.query.maxEnergy ? Number(req.query.maxEnergy) : undefined;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;

    const listings = await marketplaceService.getListings({
      status: params.status as any,
      limit: params.limit,
      minEnergy,
      maxEnergy,
      minPrice,
      maxPrice,
    });

    res.json(ListListingsResponse.parse(listings));
  } catch (error) {
    next(error);
  }
}

export async function getListingById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const listingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const listing = await marketplaceService.getListingById(listingId);
    res.json(listing);
  } catch (error) {
    next(error);
  }
}

export async function createListing(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.authContext) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }

    const input = CreateListingBody.parse(req.body);
    const listing = await marketplaceService.createListing(
      req.authContext,
      input,
    );

    res.status(201).json(listing);
  } catch (error) {
    next(error);
  }
}

export async function closeListing(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.authContext) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const listingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await marketplaceService.closeListing(req.authContext, listingId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function cancelListing(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.authContext) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const listingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await marketplaceService.cancelListing(req.authContext, listingId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
