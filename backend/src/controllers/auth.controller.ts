import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from '../config/database.js';
import env from '../config/env.js';
import { loginSchema, registerSchema } from '../utils/validator.js';

// POST /api/auth/login
export async function loginController(req: Request, res: Response): Promise<void> {
  try {
    // Valider le body
    const { email, password } = loginSchema.parse(req.body);

    // Chercher l'utilisateur par email
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({
        error: 'Identifiants invalides',
      });
      return;
    }

    // Comparer les mots de passe
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Identifiants invalides',
      });
      return;
    }

    // Créer le JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    // Retourner le token et les infos du user
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        error: 'Données invalides',
        details: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Erreur serveur',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }
}

// POST /api/auth/register (protégé ADMIN)
export async function registerController(req: Request, res: Response): Promise<void> {
  try {
    // Valider le body
    const { email, password, nom, role } = registerSchema.parse(req.body);

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        error: 'Cet email est déjà utilisé',
      });
      return;
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const newUser = await db.user.create({
      data: {
        email,
        passwordHash,
        nom,
        role,
        actif: true,
      },
    });

    // Retourner les infos du user créé (sans le password)
    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: {
        id: newUser.id,
        email: newUser.email,
        nom: newUser.nom,
        role: newUser.role,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        error: 'Données invalides',
        details: error.message,
      });
    } else if (error instanceof Error && error.message.includes('Unique constraint')) {
      res.status(409).json({
        error: 'Cet email est déjà utilisé',
      });
    } else {
      res.status(500).json({
        error: 'Erreur serveur',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }
}

// GET /api/auth/me (protégé)
export async function getMeController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Non authentifié',
      });
      return;
    }

    // Récupérer les infos du user depuis la base de données
    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        nom: true,
        role: true,
        actif: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        error: 'Utilisateur introuvable',
      });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue',
    });
  }
}
