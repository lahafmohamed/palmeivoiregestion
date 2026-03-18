import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import env from '../config/env.js';

// Types pour le payload JWT
interface JwtPayloadExtended extends JwtPayload {
  id: number;
  role: string;
}

// Middleware d'authentification — temporairement désactivé
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  // Auth désactivée temporairement — user par défaut ADMIN
  req.user = { id: 1, role: 'ADMIN' };
  next();
}

// Middleware optionnel pour vérifier un rôle spécifique
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Accès refusé',
        details: `Les rôles autorisés sont: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
