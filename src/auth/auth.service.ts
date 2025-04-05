import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { Token, TokenType } from './schemas/token.schema';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Token.name) private tokenModel: Model<Token>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(
    email: string,
    password: string,
    username?: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({
      email,
      password: hashedPassword,
      username,
    });
    await user.save();

    const accessToken = this.jwtService.sign(
      { sub: user._id, email: user.email },
      { expiresIn: this.configService.get<string>('JWT_EXPIRATION') },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user._id, email: user.email },
      { expiresIn: '7d' },
    );

    // Store tokens in database
    await this.tokenModel.create({
      token: accessToken,
      userId: user._id,
      type: 'access',
      expiresAt: new Date(
        Date.now() +
          parseInt(this.configService.get<string>('JWT_EXPIRATION')) * 1000,
      ),
    });

    await this.tokenModel.create({
      token: refreshToken,
      userId: user._id,
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600000), // 7 days
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign(
      { sub: user._id, email: user.email },
      { expiresIn: this.configService.get<string>('JWT_EXPIRATION') },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user._id, email: user.email },
      { expiresIn: '7d' },
    );

    // Store tokens in database
    await this.tokenModel.create({
      token: accessToken,
      userId: user._id,
      type: 'access',
      expiresAt: new Date(
        Date.now() +
          parseInt(this.configService.get<string>('JWT_EXPIRATION')) * 1000,
      ),
    });

    await this.tokenModel.create({
      token: refreshToken,
      userId: user._id,
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600000), // 7 days
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    const tokenDoc = await this.tokenModel.findOne({
      token: refreshToken,
      type: 'refresh',
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = this.jwtService.sign(
      { sub: user._id, email: user.email },
      { expiresIn: this.configService.get<string>('JWT_EXPIRATION') },
    );

    // Store new access token
    await this.tokenModel.create({
      token: accessToken,
      userId: user._id,
      type: 'access',
      expiresAt: new Date(
        Date.now() +
          parseInt(this.configService.get<string>('JWT_EXPIRATION')) * 1000,
      ),
    });

    return {
      access_token: accessToken,
    };
  }
}
