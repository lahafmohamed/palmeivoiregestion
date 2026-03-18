import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import env from '../config/env.js';

// Types pour le payload JWT
interface JwtPayloadExtended extends JwtPayload {
  id: number;
  role: string;
}

// Middleware d'authentification
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Token manquant ou format invalide',
        details: 'Le header Authorization doit être au format: Bearer <token>',
      });
      return;
    }

    const token = authHeader.slice(7); // Retirer "Bearer "

    // Vérifier le token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayloadExtended;

    // Attacher les infos du user à req
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Token invalide',
        details: error.message,
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expiré',
        details: 'Veuillez vous reconnecter',
      });
    } else {
      res.status(401).json({
        error: 'Authentification échouée',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }
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
