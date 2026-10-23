"use client";
import { Briefcase, type LucideIcon } from "lucide-react";
import {
  Apple, Atom, BadgeCheck, BadgeDollarSign, Beaker, BookCheck, Bug, Building, Building2, Calculator, CalendarClock, ChartColumn, ChartLine, ChefHat, CircuitBoard, ClipboardCheck, Cloud, Code, Cog, Coins, ConciergeBell, Construction, Cpu, Database, Dna, DraftingCompass, Drill, Factory, FileHeart, FileSearch, FileText, Flame, FlaskConical, FlaskRound, FolderHeart, Gavel, Globe, GraduationCap, HandCoins, Handshake, HardHat, Headset, HeartPulse, House, KanbanSquare, KeyRound, Landmark, Leaf, MapPinned, Megaphone, MessageCircle, Microscope, Network, Package, PenLine, PiggyBank, Pill, Plane, PlugZap, Presentation, Receipt, Route, Ruler, Scale, School, Search, Shield, ShieldAlert, ShieldPlus, ShoppingBag, Sigma, Snowflake, Sprout, Stethoscope, Store, Syringe, Terminal, TestTube, Trees, Truck, Umbrella, Users, Wallet, Wheat, Workflow, Wrench, Zap,
} from "lucide-react";

// One icon per job (roles.json "icon"), so jobs are told apart at a glance. Listed one by one so only these are bundled.
const ICONS: Record<string, LucideIcon> = { Apple, Atom, BadgeCheck, BadgeDollarSign, Beaker, BookCheck, Briefcase, Bug, Building, Building2, Calculator, CalendarClock, ChartColumn, ChartLine, ChefHat, CircuitBoard, ClipboardCheck, Cloud, Code, Cog, Coins, ConciergeBell, Construction, Cpu, Database, Dna, DraftingCompass, Drill, Factory, FileHeart, FileSearch, FileText, Flame, FlaskConical, FlaskRound, FolderHeart, Gavel, Globe, GraduationCap, HandCoins, Handshake, HardHat, Headset, HeartPulse, House, KanbanSquare, KeyRound, Landmark, Leaf, MapPinned, Megaphone, MessageCircle, Microscope, Network, Package, PenLine, PiggyBank, Pill, Plane, PlugZap, Presentation, Receipt, Route, Ruler, Scale, School, Search, Shield, ShieldAlert, ShieldPlus, ShoppingBag, Sigma, Snowflake, Sprout, Stethoscope, Store, Syringe, Terminal, TestTube, Trees, Truck, Umbrella, Users, Wallet, Wheat, Workflow, Wrench, Zap };

export function JobIcon({ name, size = 20, className = "" }: { name?: string; size?: number; className?: string }) {
  const I = (name && ICONS[name]) || Briefcase;
  return <I size={size} strokeWidth={1.8} aria-hidden className={className} />;
}

// The icon in a soft round tile, for cards and headings.
export function JobBadge({ name, size = "md", tone = "plain" }: { name?: string; size?: "sm" | "md" | "lg"; tone?: "plain" | "cue" }) {
  const box = size === "lg" ? "size-14" : size === "sm" ? "size-9" : "size-11";
  const icon = size === "lg" ? 28 : size === "sm" ? 18 : 22;
  return <span className={`grid shrink-0 place-items-center rounded-2xl ${tone === "cue" ? "bg-cuesoft text-cueink" : "bg-surface2 text-ink"} ${box}`}><JobIcon name={name} size={icon} /></span>;
}
