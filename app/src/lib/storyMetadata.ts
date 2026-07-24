export type Locale = 'en' | 'nl';

type LocalizedText = Record<Locale, string>;

export type MediaOverride = {
	alt: LocalizedText;
	replacement?: string;
	suppress?: boolean;
};

export type StoryMetadata = {
	slug: string;
	sourceSlug: string;
	title: LocalizedText;
	description: LocalizedText;
	publishedTime: string;
	modifiedTime: string;
	tags: string[];
	related: string[];
	media: Record<string, MediaOverride>;
};

const localized = (en: string, nl = en): LocalizedText => ({ en, nl });

export const STORY_METADATA: Record<string, StoryMetadata> = {
	juice: {
		slug: 'juice',
		sourceSlug: 'juice',
		title: localized(
			'Building for Hack Club Juice: Shanghai Game Jam Journal',
			'Bouwen voor Hack Club Juice: gamejam in Shanghai'
		),
		description: localized(
			'Nick Esselman documents building a game for Hack Club Juice and joining its Shanghai pop-up arcade, from the flight to demos and city walks.',
			'Nick Esselman vertelt over het bouwen van een game voor Hack Club Juice en de pop-uparcade in Shanghai, van de vlucht tot demo’s en stadswandelingen.'
		),
		publishedTime: '2025-11-18T12:09:34+01:00',
		modifiedTime: '2025-12-28T01:04:07+01:00',
		tags: ['Hack Club', 'game development', 'Shanghai', 'Juice'],
		related: ['neighborhood', 'undercity'],
		media: {}
	},
	florida: {
		slug: 'florida',
		sourceSlug: 'moonshot',
		title: localized(
			'Hack Club Moonshot: Florida Build & Travel Journal',
			'Hack Club Moonshot: bouw- en reisdagboek uit Florida'
		),
		description: localized(
			'Nick Esselman’s firsthand Hack Club Moonshot journal, covering project work, Kennedy Space Center, Orlando, Miami, and New York.',
			'Nick Esselmans persoonlijke dagboek van Hack Club Moonshot over projecten, Kennedy Space Center, Orlando, Miami en New York.'
		),
		publishedTime: '2025-11-16T23:25:41+01:00',
		modifiedTime: '2026-05-04T17:35:25+02:00',
		tags: ['Hack Club', 'Moonshot', 'Florida', 'travel'],
		related: ['shipwrecked', 'juice'],
		media: {
			'nas aaide de koe': {
				alt: localized('Unavailable photo from the start of the Moonshot trip'),
				suppress: true
			},
			'selfie met nas en jarrod': {
				alt: localized('Selfie with Nas and Jarrod'),
				suppress: true
			},
			'/blogimages/moonshot/20deceatingathebayside': {
				alt: localized('Dinner at Bayside Marketplace in Miami'),
				suppress: true
			},
			'/blogimages/moonshot/14decinthesunprogramming.jpg': {
				alt: localized('Programming outdoors in the Florida sunshine')
			},
			'/blogimages/moonshot/ikbijraket.png': {
				alt: localized('Nick standing beside a rocket at Kennedy Space Center')
			},
			'/blogimages/moonshot/rocketlaunch.png': {
				alt: localized('Rocket launch viewed from Kennedy Space Center')
			},
			'/blogimages/moonshot/deliverierobotsatnight.jpg': {
				alt: localized('Delivery robots travelling along a street at night')
			},
			'/blogimages/moonshot/littlehavaana.png': {
				alt: localized('Street scene in Little Havana, Miami')
			},
			'/blogimages/moonshot/shoproof.png': {
				alt: localized('View across Miami from a shop roof')
			},
			'/blogimages/moonshot/walkingonrails.png': {
				alt: localized('Walking beside railway tracks during the Florida trip')
			},
			'/blogimages/moonshot/homedepot.png': {
				alt: localized('Visiting Home Depot for project supplies')
			},
			'/blogimages/moonshot/21deconthebeaches.JPG': {
				alt: localized('The group spending 21 December at the beach')
			},
			'/blogimages/moonshot/22deconthebeach.jpg': {
				alt: localized('Ocean view from the beach on 22 December')
			},
			'/blogimages/moonshot/23decnickwithcamera.jpg': {
				alt: localized('Nick taking photographs with his camera')
			},
			'/blogimages/moonshot/24decairplanetojfk.JPG': {
				alt: localized('View from the flight to New York JFK')
			},
			'/blogimages/moonshot/24inmetrojfk.JPG': {
				alt: localized('Riding the New York subway after arriving at JFK')
			},
			'/blogimages/moonshot/newyork.png': {
				alt: localized('Night view of illuminated buildings in New York')
			},
			'/blogimages/moonshot/24lastdayaftermovie.JPG': {
				alt: localized('The group together after a movie on the final day')
			}
		}
	},
	neighborhood: {
		slug: 'neighborhood',
		sourceSlug: 'neighborhood',
		title: localized(
			'A Month at Hack Club Neighborhood in San Francisco',
			'Een maand bij Hack Club Neighborhood in San Francisco'
		),
		description: localized(
			'Nick Esselman’s month at Hack Club Neighborhood in San Francisco: building software, meeting makers, exploring the city, and documenting daily life.',
			'Nick Esselmans maand bij Hack Club Neighborhood in San Francisco: software bouwen, makers ontmoeten en het dagelijks leven vastleggen.'
		),
		publishedTime: '2025-07-21T11:10:20+02:00',
		modifiedTime: '2026-06-30T20:22:31+02:00',
		tags: ['Hack Club', 'Neighborhood', 'San Francisco', 'software'],
		related: ['undercity', 'juice'],
		media: {
			'/blogimages/neighborhood/panorama.webp': { alt: localized('Panoramic view across San Francisco') },
			'/blogimages/neighborhood/planeride.webp': { alt: localized('View from the airplane flying to San Francisco') },
			'/blogimages/neighborhood/laptopinopenroom.webp': { alt: localized('Laptop set up for coding in the shared workspace') },
			'/blogimages/neighborhood/linkedin.webp': { alt: localized('Visiting the LinkedIn office in San Francisco') },
			'/blogimages/neighborhood/morningwalkv2.webp': { alt: localized('Early morning walk through San Francisco') },
			'/blogimages/neighborhood/morningwalk.webp': { alt: localized('Quiet San Francisco street during a morning walk') },
			'/blogimages/neighborhood/target.webp': { alt: localized('Stopping at Target for supplies') },
			'/blogimages/neighborhood/mariocard.webp': { alt: localized('Mario-themed card found during the trip') },
			'/blogimages/neighborhood/gamesonfloor.webp': { alt: localized('Friends playing games together on the floor') },
			'/blogimages/neighborhood/pier.webp': { alt: localized('View along a San Francisco pier') },
			'/blogimages/neighborhood/frozenpizza.webp': { alt: localized('Frozen pizza prepared at the shared house') },
			'/blogimages/neighborhood/salesforcepark.webp': { alt: localized('Walking through Salesforce Park') },
			'/blogimages/neighborhood/applevision.webp': { alt: localized('Trying an Apple Vision Pro headset') },
			'/blogimages/neighborhood/uno.webp': { alt: localized('Playing Uno with other Hack Club members') },
			'/blogimages/neighborhood/midnightprogramming.webp': { alt: localized('Late-night programming session in the workspace') },
			'/blogimages/neighborhood/paolokikflip.mp4': { alt: localized('Paolo attempting a kickflip') },
			'/blogimages/neighborhood/paolosleeping.mp4': { alt: localized('Paolo asleep after a long day') },
			'/blogimages/neighborhood/somecarsonthestreet.mp4': { alt: localized('Cars passing on a San Francisco street') },
			'/blogimages/neighborhood/linkeditagain.webp': { alt: localized('Returning to the LinkedIn office') },
			'/blogimages/neighborhood/githubhqpanorrama1.webp': { alt: localized('Panoramic interior view of GitHub headquarters') },
			'/blogimages/neighborhood/wedobeworking.webp': { alt: localized('Hack Club members working together at a table') },
			'/blogimages/neighborhood/interviewqiththomas.webp': { alt: localized('Thomas taking part in an interview') },
			'/blogimages/neighborhood/ominterview.mp4': { alt: localized('Video interview inside the Neighborhood workspace') },
			'/blogimages/neighborhood/pokernight.webp': { alt: localized('Poker night with friends at Neighborhood') },
			'/blogimages/neighborhood/temporairypeople.webp': { alt: localized('New arrivals gathered in the shared space') },
			'/blogimages/neighborhood/paolobeingsmart.mp4': { alt: localized('Paolo explaining an idea to the group') },
			'/blogimages/neighborhood/paoloplayinggituar.mp4': { alt: localized('Paolo playing guitar') },
			'/blogimages/neighborhood/pao.mp4': { alt: localized('A candid moment with Paolo') },
			'/blogimages/neighborhood/firsttimeluandrymat.mp4': { alt: localized('First visit to a San Francisco laundromat') },
			'/blogimages/neighborhood/tablecarrying.mp4': { alt: localized('The group carrying a table together') },
			'/blogimages/neighborhood/someonejumpingoverisac.mp4': { alt: localized('A friend jumping over Isac') },
			'/blogimages/neighborhood/populated.webp': { alt: localized('Busy shared workspace during Hack Club Neighborhood') },
			'/blogimages/neighborhood/hackclubinpineconed.webp': { alt: localized('Hack Club logo assembled from pinecones') },
			'/blogimages/neighborhood/starbucks.webp': { alt: localized('Working from a Starbucks in San Francisco') },
			'/blogimages/neighborhood/train.webp': { alt: localized('Travelling through the city by train') },
			'/blogimages/neighborhood/programming.webp': { alt: localized('Programming a project on a laptop') },
			'/blogimages/neighborhood/plumming.mp4': { alt: localized('Repairing plumbing in the shared house') },
			'/blogimages/neighborhood/showerrusult.mp4': { alt: localized('Showing the result of the shower repair') },
			'/blogimages/neighborhood/openworkspace.webp': { alt: localized('Open desks inside the Neighborhood workspace') },
			'/blogimages/neighborhood/elliottDancing.mp4': { alt: localized('Elliott dancing in the shared space') },
			'/blogimages/neighborhood/paolobeinggoated.mp4': { alt: localized('Paolo celebrating with friends') },
			'/blogimages/neighborhood/gameplayofmygame.mp4': { alt: localized('Gameplay from Nick’s software project') },
			'/blogimages/neighborhood/theEnd.mp4': { alt: localized('Final moments of the month at Neighborhood') },
			'/blogimages/neighborhood/lastpic.webp': { alt: localized('Final group photo from Hack Club Neighborhood') }
		}
	},
	shipwrecked: {
		slug: 'shipwrecked',
		sourceSlug: 'shipwrecked',
		title: localized(
			'Hack Club Shipwrecked: Boston Travel Journal',
			'Hack Club Shipwrecked: reisdagboek uit Boston'
		),
		description: localized(
			'Nick Esselman’s firsthand Hack Club Shipwrecked journal, from the journey to Boston Harbor through island workshops, building, campfires, and friends.',
			'Nick Esselmans persoonlijke Hack Club Shipwrecked-dagboek over Boston Harbor, eilandworkshops, bouwen, kampvuren en nieuwe vrienden.'
		),
		publishedTime: '2025-07-21T14:27:21+02:00',
		modifiedTime: '2025-12-28T01:04:07+01:00',
		tags: ['Hack Club', 'Shipwrecked', 'Boston', 'building'],
		related: ['florida', 'undercity'],
		media: {}
	},
	undercity: {
		slug: 'undercity',
		sourceSlug: 'undercity',
		title: localized(
			'Building Hardware at Hack Club Undercity, GitHub HQ',
			'Hardware bouwen bij Hack Club Undercity op GitHub HQ'
		),
		description: localized(
			'Nick Esselman documents building hardware at Hack Club Undercity, a four-day hackathon at GitHub HQ in San Francisco with nearly 200 makers.',
			'Nick Esselman vertelt over hardware bouwen bij Hack Club Undercity, een vierdaagse hackathon op GitHub HQ in San Francisco.'
		),
		publishedTime: '2025-07-21T11:10:20+02:00',
		modifiedTime: '2025-12-28T01:04:07+01:00',
		tags: ['Hack Club', 'Undercity', 'hardware', 'GitHub'],
		related: ['neighborhood', 'shipwrecked'],
		media: {
			'/blogimages/undercity/morningdemo.webp': { alt: localized('Morning project demonstrations at Hack Club Undercity') },
			'/blogimages/undercity/dogersvssanfransico.webp': { alt: localized('Baseball game view during the San Francisco trip') },
			'/blogimages/undercity/githubroof.webp': { alt: localized('View from the roof of GitHub headquarters') },
			'/blogimages/undercity/zackpig.webp': { alt: localized('Zach presenting a playful pig-themed project') },
			'/blogimages/undercity/group.webp': { alt: localized('Group photo of makers at Hack Club Undercity') }
		}
	}
};

export const getStoryMetadata = (slug: string) => STORY_METADATA[slug];

export const getLocalizedStoryMetadata = (slug: string, locale: Locale) => {
	const story = getStoryMetadata(slug);
	if (!story) return undefined;
	return {
		...story,
		title: story.title[locale],
		description: story.description[locale]
	};
};

export const resolveMediaOverride = (storySlug: string, src: string, locale: Locale) => {
	const override = getStoryMetadata(storySlug)?.media[src];
	if (!override) return undefined;
	return {
		alt: override.alt[locale],
		replacement: override.replacement,
		suppress: override.suppress === true
	};
};
