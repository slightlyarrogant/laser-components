--
-- PostgreSQL database dump
--

\restrict kInzvh39vZ7sJYxg2CS3lzi49yYDxiFlJclk8GiQBBg4rt6HwO9RTDDjdIS4Oxz

-- Dumped from database version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ApplicationStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ApplicationStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public."ApplicationStatus" OWNER TO postgres;

--
-- Name: EnrichmentJobStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EnrichmentJobStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'RATE_LIMITED'
);


ALTER TYPE public."EnrichmentJobStatus" OWNER TO postgres;

--
-- Name: LeadStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LeadStatus" AS ENUM (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'LOST',
    'WON'
);


ALTER TYPE public."LeadStatus" OWNER TO postgres;

--
-- Name: ResearchStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ResearchStatus" AS ENUM (
    'DRAFT',
    'IN_PROGRESS',
    'COMPLETED',
    'ARCHIVED',
    'PENDING_APPROVAL',
    'AI_DISCOVERED',
    'REVIEWED',
    'REJECTED'
);


ALTER TYPE public."ResearchStatus" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'RESEARCHER',
    'SALES'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    ip_address text,
    user_agent text,
    details jsonb,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.activity_logs_id_seq OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analytics_events (
    id integer NOT NULL,
    event_type text NOT NULL,
    category text NOT NULL,
    action text NOT NULL,
    entity_id text NOT NULL,
    metadata jsonb,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id integer
);


ALTER TABLE public.analytics_events OWNER TO postgres;

--
-- Name: analytics_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.analytics_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.analytics_events_id_seq OWNER TO postgres;

--
-- Name: analytics_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.analytics_events_id_seq OWNED BY public.analytics_events.id;


--
-- Name: applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applications (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    status public."ApplicationStatus" DEFAULT 'ACTIVE'::public."ApplicationStatus" NOT NULL
);


ALTER TABLE public.applications OWNER TO postgres;

--
-- Name: applications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.applications_id_seq OWNER TO postgres;

--
-- Name: applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: countries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.countries (
    id integer NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    region_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.countries OWNER TO postgres;

--
-- Name: countries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.countries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.countries_id_seq OWNER TO postgres;

--
-- Name: countries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.countries_id_seq OWNED BY public.countries.id;


--
-- Name: enrichment_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enrichment_batches (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    "totalJobs" integer NOT NULL,
    completed_jobs integer DEFAULT 0 NOT NULL,
    failed_jobs integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    created_by text,
    started_at timestamp(3) without time zone,
    completed_at timestamp(3) without time zone,
    metadata text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.enrichment_batches OWNER TO postgres;

--
-- Name: enrichment_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.enrichment_batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.enrichment_batches_id_seq OWNER TO postgres;

--
-- Name: enrichment_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.enrichment_batches_id_seq OWNED BY public.enrichment_batches.id;


--
-- Name: enrichment_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enrichment_jobs (
    id integer NOT NULL,
    batch_id integer,
    lead_id integer NOT NULL,
    status public."EnrichmentJobStatus" DEFAULT 'PENDING'::public."EnrichmentJobStatus" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    result text,
    last_attempt_at timestamp(3) without time zone,
    completed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    metadata text,
    provider text NOT NULL
);


ALTER TABLE public.enrichment_jobs OWNER TO postgres;

--
-- Name: enrichment_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.enrichment_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.enrichment_jobs_id_seq OWNER TO postgres;

--
-- Name: enrichment_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.enrichment_jobs_id_seq OWNED BY public.enrichment_jobs.id;


--
-- Name: industrial_application_research; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.industrial_application_research (
    id integer NOT NULL,
    application_name text NOT NULL,
    industry_sector text,
    use_case_description text,
    market_potential text,
    technical_requirements text,
    competitive_landscape text,
    status public."ResearchStatus" DEFAULT 'DRAFT'::public."ResearchStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by_user_id integer NOT NULL,
    subcategory_id integer,
    product_id integer,
    ai_summary text,
    ai_recommendations text,
    ai_confidence_score double precision,
    discovered_from_product_id integer
);


ALTER TABLE public.industrial_application_research OWNER TO postgres;

--
-- Name: industrial_application_research_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.industrial_application_research_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.industrial_application_research_id_seq OWNER TO postgres;

--
-- Name: industrial_application_research_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.industrial_application_research_id_seq OWNED BY public.industrial_application_research.id;


--
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    id integer NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    status public."LeadStatus" DEFAULT 'NEW'::public."LeadStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    annual_revenue numeric(15,2),
    confidence numeric(5,2),
    country_id integer,
    description text,
    employee_count integer,
    founded_year integer,
    industry text,
    last_enriched timestamp(3) without time zone,
    linkedin_url text,
    location text,
    region_id integer,
    source text,
    source_id text,
    tags text[],
    website text,
    "sourceResearchId" integer,
    "applicationId" integer,
    "organizationId" integer,
    "productId" integer NOT NULL,
    created_by_user_id integer
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.leads_id_seq OWNER TO postgres;

--
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;


--
-- Name: learning_events; Type: TABLE; Schema: public; Owner: laser_user
--

CREATE TABLE public.learning_events (
    id integer NOT NULL,
    event_type text NOT NULL,
    resource_slug text,
    observation text NOT NULL,
    context text,
    suggested_update text,
    impact text DEFAULT 'medium'::text NOT NULL,
    applied boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.learning_events OWNER TO laser_user;

--
-- Name: learning_events_id_seq; Type: SEQUENCE; Schema: public; Owner: laser_user
--

CREATE SEQUENCE public.learning_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.learning_events_id_seq OWNER TO laser_user;

--
-- Name: learning_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: laser_user
--

ALTER SEQUENCE public.learning_events_id_seq OWNED BY public.learning_events.id;


--
-- Name: metric_aggregates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metric_aggregates (
    id integer NOT NULL,
    metric_name text NOT NULL,
    dimensions jsonb,
    count integer NOT NULL,
    sum double precision,
    min double precision,
    max double precision,
    avg double precision,
    start_date timestamp(3) without time zone NOT NULL,
    end_date timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.metric_aggregates OWNER TO postgres;

--
-- Name: metric_aggregates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.metric_aggregates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.metric_aggregates_id_seq OWNER TO postgres;

--
-- Name: metric_aggregates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.metric_aggregates_id_seq OWNED BY public.metric_aggregates.id;


--
-- Name: metric_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metric_values (
    id integer NOT NULL,
    metric_name text NOT NULL,
    value double precision NOT NULL,
    dimensions jsonb,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.metric_values OWNER TO postgres;

--
-- Name: metric_values_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.metric_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.metric_values_id_seq OWNER TO postgres;

--
-- Name: metric_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.metric_values_id_seq OWNED BY public.metric_values.id;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    content text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id integer
);


ALTER TABLE public.notes OWNER TO postgres;

--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notes_id_seq OWNER TO postgres;

--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id integer NOT NULL,
    name text NOT NULL,
    website text,
    industry text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.organizations_id_seq OWNER TO postgres;

--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: product_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_applications (
    product_id integer NOT NULL,
    application_id integer NOT NULL,
    assigned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assignedBy" text NOT NULL
);


ALTER TABLE public.product_applications OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    datasheet_url text,
    price numeric(10,2),
    sku text,
    specifications jsonb,
    subcategory_id integer NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: regions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.regions (
    id integer NOT NULL,
    name text NOT NULL,
    code text,
    parent_region_id integer
);


ALTER TABLE public.regions OWNER TO postgres;

--
-- Name: regions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.regions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.regions_id_seq OWNER TO postgres;

--
-- Name: regions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.regions_id_seq OWNED BY public.regions.id;


--
-- Name: research_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.research_attachments (
    id integer NOT NULL,
    research_id integer NOT NULL,
    url text NOT NULL,
    attachment_type text NOT NULL,
    description text,
    uploaded_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    uploaded_by_user_id integer NOT NULL
);


ALTER TABLE public.research_attachments OWNER TO postgres;

--
-- Name: research_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.research_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.research_attachments_id_seq OWNER TO postgres;

--
-- Name: research_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.research_attachments_id_seq OWNED BY public.research_attachments.id;


--
-- Name: research_collaborators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.research_collaborators (
    research_id integer NOT NULL,
    user_id integer NOT NULL,
    assigned_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text NOT NULL
);


ALTER TABLE public.research_collaborators OWNER TO postgres;

--
-- Name: research_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.research_versions (
    id integer NOT NULL,
    research_id integer NOT NULL,
    version_number integer NOT NULL,
    data_snapshot jsonb NOT NULL,
    change_description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id integer NOT NULL
);


ALTER TABLE public.research_versions OWNER TO postgres;

--
-- Name: research_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.research_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.research_versions_id_seq OWNER TO postgres;

--
-- Name: research_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.research_versions_id_seq OWNED BY public.research_versions.id;


--
-- Name: resource_versions; Type: TABLE; Schema: public; Owner: laser_user
--

CREATE TABLE public.resource_versions (
    id integer NOT NULL,
    resource_id integer NOT NULL,
    content text NOT NULL,
    version integer NOT NULL,
    change_reason text,
    changed_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.resource_versions OWNER TO laser_user;

--
-- Name: resource_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: laser_user
--

CREATE SEQUENCE public.resource_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.resource_versions_id_seq OWNER TO laser_user;

--
-- Name: resource_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: laser_user
--

ALTER SEQUENCE public.resource_versions_id_seq OWNED BY public.resource_versions.id;


--
-- Name: resources; Type: TABLE; Schema: public; Owner: laser_user
--

CREATE TABLE public.resources (
    id integer NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.resources OWNER TO laser_user;

--
-- Name: resources_id_seq; Type: SEQUENCE; Schema: public; Owner: laser_user
--

CREATE SEQUENCE public.resources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.resources_id_seq OWNER TO laser_user;

--
-- Name: resources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: laser_user
--

ALTER SEQUENCE public.resources_id_seq OWNED BY public.resources.id;


--
-- Name: score_overrides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.score_overrides (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    score integer,
    component_overrides text,
    metadata text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.score_overrides OWNER TO postgres;

--
-- Name: score_overrides_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.score_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.score_overrides_id_seq OWNER TO postgres;

--
-- Name: score_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.score_overrides_id_seq OWNED BY public.score_overrides.id;


--
-- Name: search_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.search_templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    filters jsonb NOT NULL,
    "userId" integer NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.search_templates OWNER TO postgres;

--
-- Name: search_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.search_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.search_templates_id_seq OWNER TO postgres;

--
-- Name: search_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.search_templates_id_seq OWNED BY public.search_templates.id;


--
-- Name: subcategories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subcategories (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    category_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.subcategories OWNER TO postgres;

--
-- Name: subcategories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subcategories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.subcategories_id_seq OWNER TO postgres;

--
-- Name: subcategories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subcategories_id_seq OWNED BY public.subcategories.id;


--
-- Name: tag_presets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tag_presets (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tag_presets OWNER TO postgres;

--
-- Name: tag_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tag_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tag_presets_id_seq OWNER TO postgres;

--
-- Name: tag_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tag_presets_id_seq OWNED BY public.tag_presets.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public."UserRole" DEFAULT 'SALES'::public."UserRole" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    reset_token_expiry timestamp(3) without time zone,
    reset_token_hash text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: analytics_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_events ALTER COLUMN id SET DEFAULT nextval('public.analytics_events_id_seq'::regclass);


--
-- Name: applications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: countries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries ALTER COLUMN id SET DEFAULT nextval('public.countries_id_seq'::regclass);


--
-- Name: enrichment_batches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrichment_batches ALTER COLUMN id SET DEFAULT nextval('public.enrichment_batches_id_seq'::regclass);


--
-- Name: enrichment_jobs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrichment_jobs ALTER COLUMN id SET DEFAULT nextval('public.enrichment_jobs_id_seq'::regclass);


--
-- Name: industrial_application_research id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.industrial_application_research ALTER COLUMN id SET DEFAULT nextval('public.industrial_application_research_id_seq'::regclass);


--
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- Name: learning_events id; Type: DEFAULT; Schema: public; Owner: laser_user
--

ALTER TABLE ONLY public.learning_events ALTER COLUMN id SET DEFAULT nextval('public.learning_events_id_seq'::regclass);


--
-- Name: metric_aggregates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metric_aggregates ALTER COLUMN id SET DEFAULT nextval('public.metric_aggregates_id_seq'::regclass);


--
-- Name: metric_values id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metric_values ALTER COLUMN id SET DEFAULT nextval('public.metric_values_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: regions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regions ALTER COLUMN id SET DEFAULT nextval('public.regions_id_seq'::regclass);


--
-- Name: research_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_attachments ALTER COLUMN id SET DEFAULT nextval('public.research_attachments_id_seq'::regclass);


--
-- Name: research_versions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_versions ALTER COLUMN id SET DEFAULT nextval('public.research_versions_id_seq'::regclass);


--
-- Name: resource_versions id; Type: DEFAULT; Schema: public; Owner: laser_user
--

ALTER TABLE ONLY public.resource_versions ALTER COLUMN id SET DEFAULT nextval('public.resource_versions_id_seq'::regclass);


--
-- Name: resources id; Type: DEFAULT; Schema: public; Owner: laser_user
--

ALTER TABLE ONLY public.resources ALTER COLUMN id SET DEFAULT nextval('public.resources_id_seq'::regclass);


--
-- Name: score_overrides id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.score_overrides ALTER COLUMN id SET DEFAULT nextval('public.score_overrides_id_seq'::regclass);


--
-- Name: search_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_templates ALTER COLUMN id SET DEFAULT nextval('public.search_templates_id_seq'::regclass);


--
-- Name: subcategories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subcategories ALTER COLUMN id SET DEFAULT nextval('public.subcategories_id_seq'::regclass);


--
-- Name: tag_presets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_presets ALTER COLUMN id SET DEFAULT nextval('public.tag_presets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: enrichment_batches enrichment_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrichment_batches
    ADD CONSTRAINT enrichment_batches_pkey PRIMARY KEY (id);


--
-- Name: enrichment_jobs enrichment_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrichment_jobs
    ADD CONSTRAINT enrichment_jobs_pkey PRIMARY KEY (id);


--
-- Name: industrial_application_research industrial_application_research_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.industrial_application_research
    ADD CONSTRAINT industrial_application_research_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: learning_events learning_events_pkey; Type: CONSTRAINT; Schema: public; Owner: laser_user
--

ALTER TABLE ONLY public.learning_events
    ADD CONSTRAINT learning_events_pkey PRIMARY KEY (id);


--
-- Name: metric_aggregates metric_aggregates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metric_aggregates
    ADD CONSTRAINT metric_aggregates_pkey PRIMARY KEY (id);


--
-- Name: metric_values metric_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metric_values
    ADD CONSTRAINT metric_values_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: product_applications product_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_applications
    ADD CONSTRAINT product_applications_pkey PRIMARY KEY (product_id, application_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: research_attachments research_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_attachments
    ADD CONSTRAINT research_attachments_pkey PRIMARY KEY (id);


--
-- Name: research_collaborators research_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_collaborators
    ADD CONSTRAINT research_collaborators_pkey PRIMARY KEY (research_id, user_id);


--
-- Name: research_versions research_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_versions
    ADD CONSTRAINT research_versions_pkey PRIMARY KEY (id);


--
-- Name: resource_versions resource_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: laser_user
--

ALTER TABLE ONLY public.resource_versions
    ADD CONSTRAINT resource_versions_pkey PRIMARY KEY (id);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: laser_user
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: score_overrides score_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.score_overrides
    ADD CONSTRAINT score_overrides_pkey PRIMARY KEY (id);


--
-- Name: search_templates search_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_templates
    ADD CONSTRAINT search_templates_pkey PRIMARY KEY (id);


--
-- Name: subcategories subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_pkey PRIMARY KEY (id);


--
-- Name: tag_presets tag_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_presets
    ADD CONSTRAINT tag_presets_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: activity_logs_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_logs_action_idx ON public.activity_logs USING btree (action);


--
-- Name: activity_logs_resource_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_logs_resource_type_idx ON public.activity_logs USING btree (resource_type);


--
-- Name: activity_logs_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_logs_timestamp_idx ON public.activity_logs USING btree ("timestamp");


--
-- Name: activity_logs_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_logs_user_id_idx ON public.activity_logs USING btree (user_id);


--
-- Name: analytics_events_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX analytics_events_action_idx ON public.analytics_events USING btree (action);


--
-- Name: analytics_events_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX analytics_events_category_idx ON public.analytics_events USING btree (category);


--
-- Name: analytics_events_event_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX analytics_events_event_type_idx ON public.analytics_events USING btree (event_type);


--
-- Name: analytics_events_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX analytics_events_timestamp_idx ON public.analytics_events USING btree ("timestamp");


--
-- Name: applications_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX applications_name_key ON public.applications USING btree (name);


--
-- Name: categories_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);


--
-- Name: countries_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX countries_code_key ON public.countries USING btree (code);


--
-- Name: countries_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX countries_name_key ON public.countries USING btree (name);


--
-- Name: enrichment_jobs_status_last_attempt_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX enrichment_jobs_status_last_attempt_at_idx ON public.enrichment_jobs USING btree (status, last_attempt_at);


--
-- Name: metric_aggregates_metric_name_dimensions_start_date_end_dat_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX metric_aggregates_metric_name_dimensions_start_date_end_dat_key ON public.metric_aggregates USING btree (metric_name, dimensions, start_date, end_date);


--
-- Name: metric_aggregates_metric_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX metric_aggregates_metric_name_idx ON public.metric_aggregates USING btree (metric_name);


--
-- Name: metric_aggregates_start_date_end_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX metric_aggregates_start_date_end_date_idx ON public.metric_aggregates USING btree (start_date, end_date);


--
-- Name: metric_values_metric_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX metric_values_metric_name_idx ON public.metric_values USING btree (metric_name);


--
-- Name: metric_values_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX metric_values_timestamp_idx ON public.metric_values USING btree ("timestamp");


--
-- Name: organizations_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX organizations_name_key ON public.organizations USING btree (name);


--
-- Name: products_name_subcategory_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_name_subcategory_id_key ON public.products USING btree (name, subcategory_id);


--
-- Name: products_sku_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku);


--
-- Name: regions_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX regions_code_key ON public.regions USING btree (code);


--
-- Name: regions_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX regions_name_key ON public.regions USING btree (name);


--
-- Name: research_versions_research_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX research_versions_research_id_created_at_idx ON public.research_versions USING btree (research_id, created_at);


--
-- Name: research_versions_research_id_version_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX research_versions_research_id_version_number_key ON public.research_versions USING btree (research_id, version_number);


--
-- Name: resources_slug_key; Type: INDEX; Schema: public; Owner: laser_user
--

CREATE UNIQUE INDEX resources_slug_key ON public.resources USING btree (slug);


--
-- Name: score_overrides_lead_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX score_overrides_lead_id_key ON public.score_overrides USING btree (lead_id);


--
-- Name: subcategories_category_id_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX subcategories_category_id_name_key ON public.subcategories USING btree (category_id, name);


--
-- Name: tag_presets_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tag_presets_name_key ON public.tag_presets USING btree (name);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: countries countries_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: enrichment_jobs enrichment_jobs_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrichment_jobs
    ADD CONSTRAINT enrichment_jobs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.enrichment_batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: enrichment_jobs enrichment_jobs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrichment_jobs
    ADD CONSTRAINT enrichment_jobs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: industrial_application_research industrial_application_research_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.industrial_application_research
    ADD CONSTRAINT industrial_application_research_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: industrial_application_research industrial_application_research_discovered_from_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.industrial_application_research
    ADD CONSTRAINT industrial_application_research_discovered_from_product_id_fkey FOREIGN KEY (discovered_from_product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: industrial_application_research industrial_application_research_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.industrial_application_research
    ADD CONSTRAINT industrial_application_research_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: industrial_application_research industrial_application_research_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.industrial_application_research
    ADD CONSTRAINT industrial_application_research_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leads leads_applicationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT "leads_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leads leads_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leads leads_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leads leads_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT "leads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leads leads_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT "leads_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: leads leads_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leads leads_sourceResearchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT "leads_sourceResearchId_fkey" FOREIGN KEY ("sourceResearchId") REFERENCES public.industrial_application_research(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: learning_events learning_events_resource_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: laser_user
--

ALTER TABLE ONLY public.learning_events
    ADD CONSTRAINT learning_events_resource_slug_fkey FOREIGN KEY (resource_slug) REFERENCES public.resources(slug) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notes notes_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_applications product_applications_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_applications
    ADD CONSTRAINT product_applications_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_applications product_applications_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_applications
    ADD CONSTRAINT product_applications_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: products products_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: regions regions_parent_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_parent_region_id_fkey FOREIGN KEY (parent_region_id) REFERENCES public.regions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: research_attachments research_attachments_research_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_attachments
    ADD CONSTRAINT research_attachments_research_id_fkey FOREIGN KEY (research_id) REFERENCES public.industrial_application_research(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: research_attachments research_attachments_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_attachments
    ADD CONSTRAINT research_attachments_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: research_collaborators research_collaborators_research_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_collaborators
    ADD CONSTRAINT research_collaborators_research_id_fkey FOREIGN KEY (research_id) REFERENCES public.industrial_application_research(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: research_collaborators research_collaborators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_collaborators
    ADD CONSTRAINT research_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: research_versions research_versions_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_versions
    ADD CONSTRAINT research_versions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: research_versions research_versions_research_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_versions
    ADD CONSTRAINT research_versions_research_id_fkey FOREIGN KEY (research_id) REFERENCES public.industrial_application_research(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: resource_versions resource_versions_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: laser_user
--

ALTER TABLE ONLY public.resource_versions
    ADD CONSTRAINT resource_versions_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: score_overrides score_overrides_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.score_overrides
    ADD CONSTRAINT score_overrides_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: search_templates search_templates_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.search_templates
    ADD CONSTRAINT "search_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: subcategories subcategories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TABLE _prisma_migrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public._prisma_migrations TO laser_user;


--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.activity_logs TO laser_user;


--
-- Name: SEQUENCE activity_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.activity_logs_id_seq TO laser_user;


--
-- Name: TABLE analytics_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.analytics_events TO laser_user;


--
-- Name: SEQUENCE analytics_events_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.analytics_events_id_seq TO laser_user;


--
-- Name: TABLE applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.applications TO laser_user;


--
-- Name: SEQUENCE applications_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.applications_id_seq TO laser_user;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.categories TO laser_user;


--
-- Name: SEQUENCE categories_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.categories_id_seq TO laser_user;


--
-- Name: TABLE countries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.countries TO laser_user;


--
-- Name: SEQUENCE countries_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.countries_id_seq TO laser_user;


--
-- Name: TABLE enrichment_batches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.enrichment_batches TO laser_user;


--
-- Name: SEQUENCE enrichment_batches_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.enrichment_batches_id_seq TO laser_user;


--
-- Name: TABLE enrichment_jobs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.enrichment_jobs TO laser_user;


--
-- Name: SEQUENCE enrichment_jobs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.enrichment_jobs_id_seq TO laser_user;


--
-- Name: TABLE industrial_application_research; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.industrial_application_research TO laser_user;


--
-- Name: SEQUENCE industrial_application_research_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.industrial_application_research_id_seq TO laser_user;


--
-- Name: TABLE leads; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.leads TO laser_user;


--
-- Name: SEQUENCE leads_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.leads_id_seq TO laser_user;


--
-- Name: TABLE metric_aggregates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.metric_aggregates TO laser_user;


--
-- Name: SEQUENCE metric_aggregates_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.metric_aggregates_id_seq TO laser_user;


--
-- Name: TABLE metric_values; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.metric_values TO laser_user;


--
-- Name: SEQUENCE metric_values_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.metric_values_id_seq TO laser_user;


--
-- Name: TABLE notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notes TO laser_user;


--
-- Name: SEQUENCE notes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.notes_id_seq TO laser_user;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organizations TO laser_user;


--
-- Name: SEQUENCE organizations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.organizations_id_seq TO laser_user;


--
-- Name: TABLE product_applications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_applications TO laser_user;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products TO laser_user;


--
-- Name: SEQUENCE products_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.products_id_seq TO laser_user;


--
-- Name: TABLE regions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.regions TO laser_user;


--
-- Name: SEQUENCE regions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.regions_id_seq TO laser_user;


--
-- Name: TABLE research_attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.research_attachments TO laser_user;


--
-- Name: SEQUENCE research_attachments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.research_attachments_id_seq TO laser_user;


--
-- Name: TABLE research_collaborators; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.research_collaborators TO laser_user;


--
-- Name: TABLE research_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.research_versions TO laser_user;


--
-- Name: SEQUENCE research_versions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.research_versions_id_seq TO laser_user;


--
-- Name: TABLE score_overrides; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.score_overrides TO laser_user;


--
-- Name: SEQUENCE score_overrides_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.score_overrides_id_seq TO laser_user;


--
-- Name: TABLE search_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.search_templates TO laser_user;


--
-- Name: SEQUENCE search_templates_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.search_templates_id_seq TO laser_user;


--
-- Name: TABLE subcategories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.subcategories TO laser_user;


--
-- Name: SEQUENCE subcategories_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.subcategories_id_seq TO laser_user;


--
-- Name: TABLE tag_presets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tag_presets TO laser_user;


--
-- Name: SEQUENCE tag_presets_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.tag_presets_id_seq TO laser_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO laser_user;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO laser_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO laser_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO laser_user;


--
-- PostgreSQL database dump complete
--

\unrestrict kInzvh39vZ7sJYxg2CS3lzi49yYDxiFlJclk8GiQBBg4rt6HwO9RTDDjdIS4Oxz

