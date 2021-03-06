class Lick < ApplicationRecord
  belongs_to :user
  belongs_to :artist, optional: true
  has_many :lick_tonalities
  has_many :backing_track_licks
  has_many :genre_licks
  has_many :tonalities, through: :lick_tonalities
  has_many :backing_tracks, through: :backing_track_licks
  has_many :genres, through: :genre_licks
  has_many :notes

  validates :name, presence: true
  validates :performance_rating, :inclusion => { :in => 1..5 }, allow_nil: true

  before_validation :nil_if_blank

  include CustomSetters::InstanceMethods

  NULL_ATTRS = %w( name bpm current_key description link performance_rating )

  SORT_OPTIONS = [
    "Tonality",
    "Artist",
    "Date Last Practiced",
    "Scheduled Practice Date"
  ]

  def nil_if_blank
    NULL_ATTRS.each {|attr| self[attr] = nil if self[attr].blank?}
  end

  def self.licks_of_the_day(user)
    user.licks.select do |l|
      DateTime.now.strftime("%m/%d/%Y") == l.scheduled_practice.try(:strftime, "%m/%d/%Y")
    end
  end

  def self.overdue_licks(user)
    user.licks.select do |l|
      if sch_date = l.scheduled_practice.try(:end_of_day)
        DateTime.now > sch_date
      else
        false
      end
    end
  end

  def self.sloppiest_licks(user)
    Lick.all.where("user_id = ? AND performance_rating IS NOT NULL AND performance_rating <= 3", user.id).order("performance_rating ASC").limit(5)
  end

  def new_tonalities=(tonalities_attr)
    unless new_tonalities_blank?(tonalities_attr)
      tonalities_attr.each do |tonality_attr|
        unless tonality_attr[:name].blank?
          tonality = Tonality.find_or_create_by(tonality_attr)
          self.lick_tonalities.build(tonality: tonality)
        end
      end
    end
  end

  def new_tonalities_blank?(tonalities_attr)
    tonalities_attr[0][:name].blank? && tonalities_attr[1][:name].blank?
  end

  def new_backing_track=(backing_track_attr)
    unless backing_track_blank?(backing_track_attr)
      backing_track = BackingTrack.find_or_create_by(name: backing_track_attr[:name], link: backing_track_attr[:link])
      self.backing_track_licks.build(backing_track: backing_track)
    end
  end

  def backing_track_blank?(attributes)
    attributes["name"].blank? || attributes["link"].blank?
  end

  def self.grouped_options(user)
    tonalities = user.licks.collect do |l|
      l.tonalities.collect do |t|
        t.name
      end
    end
    artists = user.licks.reject{|l| l.artist.try(:name) == nil}.collect do |l|
      l.artist.name
    end
    options = [
      ["Tonalities", tonalities.flatten],
      ["Artists", artists]
    ]
  end

  def self.filter_and_sort_licks(user, params)
    filtered_collection = self.filter_licks(user, params[:filter])
    filtered_and_sorted_collection = self.sort_licks(filtered_collection, params[:sort])
  end

  def self.filter_licks(user, filter)
    if filter.blank?
      user.licks
    elsif artist_filter = Artist.find_by(name: filter)
      user.licks.where("artist_id = ?", artist_filter.id)
    else
      user.licks.select {|l| l.tonalities_names.include?(filter)}
    end
  end

  def self.sort_licks(collection, sort_by)
    if sort_by.blank? || sort_by.nil?
      collection
    else
      self.send("#{sort_by.downcase.gsub(" ", "_")}_sort", collection)
    end
  end

  def tonalities_names
    names = self.tonalities.collect{|t| t.name}
  end

  def self.tonality_sort(collection)
    tonality_hash = {}

    # Collect unique tonality names to be used as keys
    tonality_names = collection.collect{|l| l.tonalities_names}.flatten.uniq

    # Use those unique tonality names to set hash keys and generate collections
    # of licks with those specific tonalities
    tonality_names.each do |t|
      tonality_hash[t] ||= []
      tonality_hash[t] << collection.select{|l| l.tonalities_names.include?(t)}
      tonality_hash[t].flatten!
    end

    # Handle licks with no tonalities for the final collection
    no_tonality_licks = collection.select{|l| l.tonalities.blank?}
    tonality_hash["No Tonality"] = no_tonality_licks unless no_tonality_licks.empty?

    # return this hash to be iterated through in the view
    tonality_hash
  end

  def self.artist_sort(collection)
    artist_hash = {}
    artist_names = self.remove_nil_artists(collection).collect{|l| l.artist.name}.uniq

    artist_names.each do |a|
      artist_hash[a] ||= []
      artist_hash[a] << collection.select{|l| l.artist.try(:name) == a}
      artist_hash[a].flatten!
    end

    no_artist_licks = collection.select{|l| l.artist.nil?}
    artist_hash["No Artist"] = no_artist_licks unless no_artist_licks.empty?
    artist_hash
  end

  def self.remove_nil_artists(collection)
    collection.reject{|l| l.artist == nil}
  end

  def self.date_last_practiced_sort(collection)
    dated_sort(collection, "last_practiced")
  end

  def self.scheduled_practice_date_sort(collection)
    dated_sort(collection, "scheduled_practice")
  end

  def self.dated_sort(collection, attribute)
    with_dates = collection.select{|l| l.send("#{attribute}")}
    without_dates = collection.select{|l| l.send("#{attribute}").nil?}
    if with_dates.count == 0
      collection
    else
      sorted_collection = with_dates.sort_by(&:"#{attribute}").reverse
      sorted_collection << without_dates
      sorted_collection.flatten
    end

  end
end
